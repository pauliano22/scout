// GET /api/cron/backup-database — daily logical backup, OFF-TABLE this time.
// Protected by CRON_SECRET (authorization: Bearer <secret> or x-cron-secret).
//
// The previous version of this route stored snapshots in a backup_files table
// inside the same database it was protecting — circular (a corruption event
// destroys the backups with the data) — and targeted tables that were never
// created in prod. This version pages every known table via the service
// client, gzips JSONL per table, and uploads to the PRIVATE `db-backups`
// storage bucket under YYYY-MM-DD/<table>.jsonl.gz, pruning days older than
// RETENTION_DAYS. The bucket is created on first run (private; the dumps
// contain alumni PII, so it must never be public).
//
// auth.users is exported via the admin API (PostgREST can't reach the auth
// schema). NOTE: listUsers cannot export password hashes, so the auth snapshot
// preserves identities/emails/metadata only — a real auth restore means
// admin.createUser per row plus forced password resets; credential-level
// recovery needs Supabase's own PITR/pg_dump. alumni.embedding is excluded:
// it's a regenerable vector that is ~95% of the table's bytes (~19KB/row vs
// ~1KB for the rest of the row); embedding_updated_at IS kept so regeneration
// can be targeted after restore.
//
// Restore: scripts/restore-from-backup.mjs downloads and unpacks a day's
// snapshot; re-import is upsert({onConflict:'id'}) in FK order (schools,
// teams, profiles, alumni, then dependents), then re-run the embedding job.

import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/requestAuth'
import { gzipSync } from 'node:zlib'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BUCKET = 'db-backups'
const RETENTION_DAYS = 30
const PAGE = 1000

// Union of every table the migrations define plus known undeclared drift
// (password_reset_tokens). Prod schema has drifted from the migration files in
// both directions, so tables missing from prod are skipped per-run rather than
// failing the backup; a table added to prod without a migration must be added
// here by hand. backup_files is deliberately absent (deprecated circular
// design, migration 043 was never applied).
const TABLES = [
  'abandoned_registrations',
  'achievements',
  'activity_log',
  'alumni',
  'alumni_outreach_ledger',
  'alumni_removal_requests',
  'alumni_suppression',
  'alumni_swipes',
  'ambassador_profiles',
  'census_reports',
  'company_aliases',
  'connection_action_state',
  'daily_goals',
  'digest_queue',
  'digest_settings',
  'event_chat_messages',
  'event_chat_sessions',
  'event_participants',
  'event_rsvps',
  'events',
  'feature_flags',
  'graduation_verification',
  'image_cache',
  'job_applications',
  'job_listings',
  'jobs',
  'mentorship',
  'messages',
  'networking_plans',
  'onboarding_progress',
  'opportunities',
  'opportunity_saves',
  'outreach_queue',
  'password_reset_audit_log',
  'password_reset_tokens',
  'plan_alumni',
  'plan_custom_contacts',
  'profile_keywords',
  'profiles',
  'referral_links',
  'referral_redemptions',
  'reported_content',
  'role_change_log',
  'roster_entries',
  'schools',
  'security_alerts',
  'security_events',
  'signup_events',
  'sport_normalization',
  'suggested_actions',
  'teams',
  'testimonial_requests',
  'testimonials',
  'user_achievements',
  'user_events',
  'user_job_interactions',
  'user_networks',
  'user_stats',
] as const

// Tables without an id column: order by primary key for stable pagination —
// the created_at fallback is non-unique (batch inserts share timestamps) and
// ties straddling a page boundary can skip or duplicate rows past 1,000 rows.
const ORDER_COLS: Record<string, string[]> = {
  teams: ['code'],
  event_rsvps: ['event_id', 'profile_id'],
  opportunity_saves: ['opportunity_id', 'profile_id'],
  feature_flags: ['flag_name'],
  sport_normalization: ['canonical_name'],
  digest_settings: ['user_id'],
  onboarding_progress: ['user_id'],
}

// Regenerable bulk that must not be archived (would 10x the backup).
const EXCLUDE_COLUMNS: Record<string, string[]> = {
  alumni: ['embedding'],
}

type Db = ReturnType<typeof serviceClient>

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (
    req.headers.get('authorization') === `Bearer ${secret}` ||
    req.headers.get('x-cron-secret') === secret
  )
}

function isMissingTable(err: { code?: string; message?: string }): boolean {
  return err.code === 'PGRST205' || /could not find the table/i.test(err.message ?? '')
}

// Page a table into JSONL. Returns null when the table doesn't exist in prod.
async function dumpTable(db: Db, table: string): Promise<{ rows: number; body: string } | null> {
  const probe = await db.from(table).select('*').limit(1)
  if (probe.error) {
    if (isMissingTable(probe.error)) return null
    throw new Error(`${table}: ${probe.error.message}`)
  }
  const sample = (probe.data?.[0] ?? null) as Record<string, unknown> | null
  const excluded = EXCLUDE_COLUMNS[table] ?? []
  const cols = sample && excluded.length
    ? Object.keys(sample).filter(k => !excluded.includes(k)).join(',')
    : '*'
  // Stable pagination needs a stable order: PK columns from ORDER_COLS, else
  // id, else created_at (unique enough only for tables that stay small).
  const orderCols = ORDER_COLS[table]
    ?? (sample ? ('id' in sample ? ['id'] : 'created_at' in sample ? ['created_at'] : [Object.keys(sample)[0]]) : [])

  const lines: string[] = []
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(cols).range(from, from + PAGE - 1)
    for (const c of orderCols) q = q.order(c, { ascending: true })
    const { data, error } = await q
    if (error) throw new Error(`${table} page@${from}: ${error.message}`)
    const rows = (data ?? []) as unknown as Record<string, unknown>[]
    for (const row of rows) lines.push(JSON.stringify(row))
    if (rows.length < PAGE) break
  }
  return { rows: lines.length, body: lines.join('\n') }
}

async function dumpAuthUsers(db: Db): Promise<{ rows: number; body: string }> {
  const lines: string[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`auth users page ${page}: ${error.message}`)
    for (const u of data.users) lines.push(JSON.stringify(u))
    if (data.users.length < 1000) break
  }
  return { rows: lines.length, body: lines.join('\n') }
}

async function ensureBucket(db: Db): Promise<void> {
  const { error } = await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: '500MB' })
  if (!error) return
  // 409 = bucket already exists (every night after the first). Match the
  // status code, not just the server's message text, which can be reworded.
  const status = (error as { status?: number }).status
  if (status === 409 || /already exists/i.test(error.message)) return
  throw new Error(`bucket create failed: ${error.message}`)
}

async function prune(db: Db): Promise<{ pruned_days: number; prune_errors: string[] }> {
  const cutoff = Date.now() - RETENTION_DAYS * 86_400_000
  const errors: string[] = []
  let pruned = 0
  const { data: entries, error } = await db.storage.from(BUCKET).list('', { limit: 1000 })
  if (error) return { pruned_days: 0, prune_errors: [error.message] }
  for (const entry of entries ?? []) {
    const m = /^(\d{4}-\d{2}-\d{2})$/.exec(entry.name)
    if (!m) continue
    if (new Date(`${m[1]}T00:00:00Z`).getTime() >= cutoff) continue
    const { data: files, error: listErr } = await db.storage.from(BUCKET).list(entry.name, { limit: 1000 })
    if (listErr || !files?.length) {
      if (listErr) errors.push(`${entry.name}: ${listErr.message}`)
      continue
    }
    const { error: rmErr } = await db.storage
      .from(BUCKET)
      .remove(files.map(f => `${entry.name}/${f.name}`))
    if (rmErr) errors.push(`${entry.name}: ${rmErr.message}`)
    else pruned += 1
  }
  return { pruned_days: pruned, prune_errors: errors }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()
  const day = new Date().toISOString().slice(0, 10)

  try {
    await ensureBucket(db)
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }

  const backed: Array<{ table: string; rows: number; gzip_bytes: number }> = []
  const skipped: string[] = []
  const failures: Array<{ table: string; error: string }> = []

  const upload = async (table: string, dump: { rows: number; body: string }) => {
    const gz = gzipSync(Buffer.from(dump.body, 'utf-8'))
    const { error } = await db.storage
      .from(BUCKET)
      .upload(`${day}/${table}.jsonl.gz`, gz, { contentType: 'application/gzip', upsert: true })
    if (error) throw new Error(`${table} upload: ${error.message}`)
    backed.push({ table, rows: dump.rows, gzip_bytes: gz.byteLength })
  }

  for (const table of TABLES) {
    try {
      const dump = await dumpTable(db, table)
      if (!dump) {
        skipped.push(table)
        continue
      }
      await upload(table, dump)
    } catch (e) {
      const msg = (e as Error).message
      console.error(`[backup-database] ${msg}`)
      failures.push({ table, error: msg })
    }
  }

  try {
    await upload('auth_users', await dumpAuthUsers(db))
  } catch (e) {
    const msg = (e as Error).message
    console.error(`[backup-database] ${msg}`)
    failures.push({ table: 'auth_users', error: msg })
  }

  const { pruned_days, prune_errors } = await prune(db)

  // Non-200 on ANY failure: Vercel's cron dashboard keys off the HTTP status,
  // and nobody reads the response body of a nightly cron — a partial backup
  // must not look like a successful one.
  const ok = failures.length === 0 && prune_errors.length === 0
  return NextResponse.json({
    ok,
    date: day,
    tables_backed_up: backed.length,
    total_rows: backed.reduce((n, t) => n + t.rows, 0),
    total_gzip_bytes: backed.reduce((n, t) => n + t.gzip_bytes, 0),
    tables: backed,
    skipped_missing: skipped,
    failures,
    pruned_days,
    prune_errors,
  }, { status: ok ? 200 : 500 })
}
