/**
 * Deduplicate alumni records.
 *
 * Finds potential duplicate alumni rows (same email, same full_name + sport,
 * or similar linkedin_url), picks the most complete record in each group,
 * transfers all FK references to the canonical record, and marks the
 * others as duplicates.
 *
 * Usage:
 *   npm run scripts:dedup                       # dry-run (default)
 *   npm run scripts:dedup -- --apply            # actually merge
 *   npm run scripts:dedup -- --apply --group=   # merge a specific group
 *
 * Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ─────────────────────────────────────────────────────
// Argument parsing
// ─────────────────────────────────────────────────────

interface Args {
  apply: boolean
  group: string | null  // comma-separated UUIDs
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  return {
    apply: args.includes('--apply'),
    group: args.find((a) => a.startsWith('--group='))?.slice('--group='.length) ?? null,
  }
}

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

interface DuplicateCandidate {
  alumni_id_1: string
  alumni_id_2: string
  match_reason: string
}

interface MergeResult {
  canonical_id: string
  merged_ids: string[]
  records_merged: number
  match_reason?: string
}

// ─────────────────────────────────────────────────────
// Core logic
// ─────────────────────────────────────────────────────

async function run({ apply, group }: Args) {
  // ── Phase 1: Find duplicates ──────────────────────
  console.log(`\n🔍 Finding duplicate alumni records...`)

  let candidates: DuplicateCandidate[] = []

  if (group) {
    const ids = group.split(',').map((s) => s.trim()).filter(Boolean)
    console.log(`   Using manual group: ${ids.join(', ')}`)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        candidates.push({ alumni_id_1: ids[i], alumni_id_2: ids[j], match_reason: 'manual' })
      }
    }
  } else {
    const { data, error } = await supabase.rpc('find_duplicate_alumni')

    if (error) {
      console.error(`✗ Failed to find duplicates: ${error.message}`)
      process.exit(1)
    }

    candidates = (data ?? []) as DuplicateCandidate[]
  }

  if (candidates.length === 0) {
    console.log('✅ No duplicate alumni records found.')
    return
  }

  console.log(`\n📋 Found ${candidates.length} duplicate pair(s):\n`)

  const byReason: Record<string, DuplicateCandidate[]> = {}
  for (const c of candidates) {
    if (!byReason[c.match_reason]) byReason[c.match_reason] = []
    byReason[c.match_reason].push(c)
  }

  for (const [reason, pairs] of Object.entries(byReason)) {
    console.log(`   ${reason}: ${pairs.length} pair(s)`)
    for (const p of pairs) {
      console.log(`     ${p.alumni_id_1}  ↔  ${p.alumni_id_2}`)
    }
  }

  // ── Phase 2: Resolve transitive groups ────────────
  const adj = new Map<string, Set<string>>()

  function addEdge(a: string, b: string) {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }

  for (const c of candidates) {
    addEdge(c.alumni_id_1, c.alumni_id_2)
  }

  const visited = new Set<string>()
  const groups: string[][] = []

  for (const start of adj.keys()) {
    if (visited.has(start)) continue
    const group: string[] = []
    const queue = [start]
    visited.add(start)
    while (queue.length > 0) {
      const v = queue.shift()!
      group.push(v)
      for (const neighbor of adj.get(v) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    groups.push(group)
  }

  console.log(`\n📦 Resolved ${groups.length} transitive group(s) to merge:\n`)
  for (const g of groups) {
    console.log(`   [${g.join(', ')}]`)
  }

  if (!apply) {
    console.log(`\n⚠️  DRY-RUN — no changes applied.`)
    console.log(`   Re-run with --apply to commit the merges.`)
    return
  }

  // ── Phase 3: Merge each group ─────────────────────
  console.log(`\n🔄 Merging duplicate groups...`)

  const results: MergeResult[] = []

  for (const g of groups) {
    console.log(`   Merging group: [${g.join(', ')}]`)

    const { data, error } = await supabase.rpc('merge_alumni_duplicates', {
      group_ids: g,
    })

    if (error) {
      console.error(`   ✗ Merge failed for group: ${error.message}`)
      continue
    }

    const result = (data ?? []) as MergeResult[]
    for (const r of result) {
      console.log(`     ✓ Canonical: ${r.canonical_id}, merged ${r.records_merged} record(s)`)
      results.push(r)
    }
  }

  const totalMerged = results.reduce((sum, r) => sum + r.records_merged, 0)
  console.log(`\n✅ Done. ${results.length} canonical record(s) kept, ${totalMerged} record(s) marked as duplicates.`)

  console.log(`\n📊 Merge log:\n`)
  for (const r of results) {
    console.log(`   canonical: ${r.canonical_id}`)
    console.log(`   merged:    ${r.merged_ids.join(', ')}`)
    console.log(`   count:     ${r.records_merged}`)
    console.log(``)
  }
}

// ─────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────

run(parseArgs()).catch((err) => {
  console.error(err)
  process.exit(1)
})
