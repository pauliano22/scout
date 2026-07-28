#!/usr/bin/env node
// Recruiting email collection system, two halves of a loop:
//
//   node scripts/recruiting-emails.mjs worklist [team-filter]
//     → writes ~/Desktop/scout-email-worklist.csv: every prospect missing a
//       contact_email, prioritized (focus-pinned teams first, then biggest
//       roster), each with a pre-filled Cornell people-search link and a
//       netid-initials hint so a human lookup takes seconds.
//
//   node scripts/recruiting-emails.mjs load <filled.csv>
//     → validates the filled-in email column (@cornell.edu, format, initials
//       sanity vs the name — warns, never guesses), then upserts into
//       recruiting_prospects.contact_email (never overwrites an existing
//       value) and prints what changed.
//
// The lookup itself stays HUMAN on purpose: directory access is personal,
// rate-natural, and policy-safe. This tool only removes the bookkeeping.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function env() {
  const src = readFileSync(join(ROOT, 'apps/web/.env.local'), 'utf8')
  const out = {}
  for (const line of src.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const E = env()
const BASE = E.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/'
const HEADERS = {
  apikey: E.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function rest(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { ...HEADERS, ...(opts.headers ?? {}) } })
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function restAll(path) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const rows = await rest(path, { headers: { Range: `${from}-${from + 999}` } })
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}

const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`

function initialsHint(fullName) {
  let name = fullName.trim()
  const comma = name.indexOf(',')
  if (comma > 0) name = `${name.slice(comma + 1).trim()} ${name.slice(0, comma).trim()}`
  const parts = name.toLowerCase().replace(/[^a-z\s-]/g, '').replace(/-/g, ' ').split(/\s+/).filter(Boolean)
  if (parts.length < 2) return ''
  return `${parts[0][0]}${parts[parts.length - 1][0]}* or ${parts[0][0]}?${parts[parts.length - 1][0]}*`
}

async function universeMissingEmail() {
  const cutoff = new Date().getFullYear() + (new Date().getMonth() >= 5 ? 1 : 0)
  const [alumni, prospects, teams] = await Promise.all([
    restAll(`alumni?select=id,full_name,sport,graduation_year,is_duplicate,is_public&graduation_year=gte.${cutoff}`),
    restAll('recruiting_prospects?select=alumni_id,contact_email'),
    restAll('recruiting_teams?select=team_key,is_focus'),
  ])
  const hasEmail = new Set(prospects.filter(p => p.contact_email).map(p => p.alumni_id))
  const focus = new Set(teams.filter(t => t.is_focus).map(t => t.team_key))
  const rows = alumni.filter(a =>
    a.is_duplicate !== true && a.is_public !== false && a.full_name?.trim() && !hasEmail.has(a.id),
  )
  return { rows, focus }
}

async function worklist(teamFilter) {
  const { rows, focus } = await universeMissingEmail()
  const bySport = new Map()
  for (const r of rows) {
    const list = bySport.get(r.sport) ?? []
    list.push(r)
    bySport.set(r.sport, list)
  }
  const sports = [...bySport.keys()].sort((a, b) =>
    Number(focus.has(b)) - Number(focus.has(a)) || bySport.get(b).length - bySport.get(a).length,
  )

  const lines = ['alumni_id,name,team,year,netid_hint,directory_search,email']
  let count = 0
  for (const sport of sports) {
    if (teamFilter && !sport.toLowerCase().includes(teamFilter.toLowerCase())) continue
    for (const r of bySport.get(sport).sort((a, b) => a.full_name.localeCompare(b.full_name))) {
      const url = `https://www.cornell.edu/search/?tab=people&q=${encodeURIComponent(r.full_name)}`
      lines.push([r.id, r.full_name, sport, r.graduation_year, initialsHint(r.full_name), url, ''].map(esc).join(','))
      count++
    }
  }
  const out = join(process.env.HOME, 'Desktop', 'scout-email-worklist.csv')
  writeFileSync(out, lines.join('\n'))
  console.log(`${count} prospects missing an email → ${out}`)
  console.log('Teams (missing count, focus-pinned first):')
  for (const sport of sports) {
    if (teamFilter && !sport.toLowerCase().includes(teamFilter.toLowerCase())) continue
    console.log(`  ${focus.has(sport) ? '★ ' : '  '}${bySport.get(sport).length.toString().padStart(3)}  ${sport}`)
  }
  console.log('\nFill the email column (netid@cornell.edu), then: node scripts/recruiting-emails.mjs load ~/Desktop/scout-email-worklist.csv')
}

function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQ = false
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (field || row.length) { row.push(field); rows.push(row); row = []; field = '' }
      if (c === '\r' && text[i + 1] === '\n') i++
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

async function load(file) {
  const [header, ...rows] = parseCsv(readFileSync(file, 'utf8'))
  const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]))
  for (const need of ['alumni_id', 'name', 'email']) {
    if (!(need in col)) throw new Error(`CSV missing column: ${need}`)
  }

  const existing = await restAll('recruiting_prospects?select=alumni_id,contact_email')
  const byId = new Map(existing.map(p => [p.alumni_id, p]))

  let loaded = 0, skippedExisting = 0, warned = 0
  const inserts = []
  for (const r of rows) {
    const email = (r[col.email] ?? '').trim().toLowerCase()
    if (!email) continue
    const alumniId = r[col.alumni_id]?.trim()
    const name = r[col.name]?.trim() ?? ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.warn(`SKIP invalid email for ${name}: ${email}`); warned++; continue
    }
    if (!email.endsWith('@cornell.edu')) {
      console.warn(`WARN non-cornell email for ${name}: ${email} (loading anyway)`)
    }
    const hint = initialsHint(name)
    const letters = email.split('@')[0].match(/^[a-z]+/)?.[0] ?? ''
    if (hint && letters && (letters[0] !== hint[0] || letters[letters.length - 1] !== hint[1])) {
      console.warn(`WARN netid "${letters}" doesn't fit initials of "${name}" — double-check`); warned++
    }
    const ex = byId.get(alumniId)
    if (ex?.contact_email) { skippedExisting++; continue }
    if (ex) {
      await rest(`recruiting_prospects?alumni_id=eq.${alumniId}`, {
        method: 'PATCH', body: JSON.stringify({ contact_email: email }),
      })
    } else {
      inserts.push({ alumni_id: alumniId, contact_email: email })
    }
    loaded++
  }
  for (let i = 0; i < inserts.length; i += 100) {
    await rest('recruiting_prospects?on_conflict=alumni_id', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(inserts.slice(i, i + 100)),
    })
  }
  console.log(`loaded ${loaded} emails (${skippedExisting} already set were left alone, ${warned} warnings)`)
  const check = await fetch(BASE + 'recruiting_prospects?select=id&contact_email=not.is.null', {
    headers: { ...HEADERS, Prefer: 'count=exact', Range: '0-0' },
  })
  console.log('prospects with an email now:', check.headers.get('content-range')?.split('/')[1])
}

const [mode, arg] = process.argv.slice(2)
if (mode === 'worklist') await worklist(arg)
else if (mode === 'load' && arg) await load(arg)
else {
  console.log('usage:\n  node scripts/recruiting-emails.mjs worklist [team-filter]\n  node scripts/recruiting-emails.mjs load <filled.csv>')
  process.exit(1)
}
