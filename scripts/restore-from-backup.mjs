#!/usr/bin/env node
// Download and unpack a day's database backup from the private `db-backups`
// storage bucket (written nightly by /api/cron/backup-database).
//
//   node scripts/restore-from-backup.mjs                  # list available days
//   node scripts/restore-from-backup.mjs 2026-07-21       # download + gunzip all tables
//   node scripts/restore-from-backup.mjs 2026-07-21 alumni user_networks
//
// Files land in ./backups/restore/<date>/<table>.jsonl (one JSON row per line).
// This script only ever READS from prod. Re-importing is deliberately manual:
// upsert({ onConflict: 'id' }) in FK order — schools, teams, profiles (+
// auth_users via auth admin API), alumni, then dependents (plan_alumni,
// user_networks, outreach_queue, messages, user_events, ...), 500-row batches.
// auth_users has NO password hashes (listUsers can't export them): auth
// restore = admin.createUser per row + forced password-reset emails.
// alumni.embedding is not in the backup by design; re-run the embedding job
// after an alumni restore. For full-DB corruption, restore into a FRESH
// Supabase project rather than in-place.
//
// Requires apps/web/.env.local (never prints values).

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(repoRoot, 'package.json'))
const { createClient } = require('@supabase/supabase-js')

const BUCKET = 'db-backups'

const env = readFileSync(join(repoRoot, 'apps/web/.env.local'), 'utf8')
const get = k => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim().replace(/^"|"$/g, '')
const url = get('NEXT_PUBLIC_SUPABASE_URL') || get('SUPABASE_URL')
const key = get('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local')
  process.exit(1)
}
const db = createClient(url, key)

const [date, ...onlyTables] = process.argv.slice(2)

if (!date) {
  const { data, error } = await db.storage.from(BUCKET).list('', { limit: 1000 })
  if (error) { console.error('list failed:', error.message); process.exit(1) }
  const days = (data ?? []).map(e => e.name).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort()
  if (!days.length) { console.log('No backups found in bucket', BUCKET); process.exit(0) }
  console.log('Available backup days:')
  for (const d of days) console.log(' ', d)
  console.log('\nUsage: node scripts/restore-from-backup.mjs <date> [tables...]')
  process.exit(0)
}

const { data: files, error } = await db.storage.from(BUCKET).list(date, { limit: 1000 })
if (error || !files?.length) {
  console.error(`No backup found for ${date}${error ? `: ${error.message}` : ''}`)
  process.exit(1)
}

const outDir = join(repoRoot, 'backups', 'restore', date)
mkdirSync(outDir, { recursive: true })

let ok = 0
for (const f of files) {
  const table = f.name.replace(/\.jsonl\.gz$/, '')
  if (onlyTables.length && !onlyTables.includes(table)) continue
  const { data: blob, error: dlErr } = await db.storage.from(BUCKET).download(`${date}/${f.name}`)
  if (dlErr) { console.error(`  ${table}: download failed: ${dlErr.message}`); continue }
  const jsonl = gunzipSync(Buffer.from(await blob.arrayBuffer())).toString('utf8')
  const rows = jsonl ? jsonl.split('\n').length : 0
  writeFileSync(join(outDir, `${table}.jsonl`), jsonl)
  console.log(`  ${table}: ${rows} rows`)
  ok += 1
}
console.log(`\n${ok} table(s) written to ${outDir}`)
