#!/usr/bin/env npx tsx
/**
 * Daily dedup job for alumni records.
 *
 * Finds potential duplicate alumni records based on:
 *   a. Same email                                   → highest confidence
 *   b. Same full_name + same sport + grad yr ±1     → high confidence
 *   c. Same full_name + same linkedin_url (partial)  → high confidence
 *
 * For duplicates, merges by keeping the most complete record, copying
 * null fields from the duplicate into the target, then deleting the
 * duplicate.
 *
 * Usage:
 *   npm run dedup:alumni                       # dry-run (default, safe)
 *   npm run dedup:alumni -- --apply            # actually merge + delete
 *
 * Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

// ── Config ────────────────────────────────────────────
const BATCH_SIZE = 500
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── Types ─────────────────────────────────────────────
interface AlumniRecord {
  id: string
  full_name: string
  email: string | null
  linkedin_url: string | null
  sport: string
  graduation_year: number
  company: string | null
  role: string | null
  industry: string | null
  location: string | null
  avatar_url: string | null
  photo_url: string | null
  display_headline: string | null
  work_history: unknown[] | null
  skills: string[] | null
  education: unknown[] | null
  bio: string | null
  advice: string | null
  is_claimed: boolean
  is_verified: boolean
  source: string
  school_id: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown // allow index access
}

interface DuplicatePair {
  id1: string
  id2: string
  reason: string
  confidence: 'highest' | 'high'
}

interface MergeGroup {
  ids: string[]
  reason: string
}

interface MergeReport {
  canonicalId: string
  mergedIds: string[]
  reason: string
  canonicalScore: number
  mergedScore: number
  fieldsCopied: string[]
  success: boolean
  error?: string
}

// ── Argument parsing ─────────────────────────────────
interface Args {
  apply: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  return {
    apply: args.includes('--apply'),
  }
}

// ── LinkedIn URL normalisation ───────────────────────
/**
 * Extract the LinkedIn profile username from a URL.
 * Handles: https://www.linkedin.com/in/username, http://linkedin.com/in/username/
 * trailing slashes, query params, etc.
 */
function extractLinkedinUsername(url: string | null): string | null {
  if (!url) return null
  try {
    const match = url.match(
      /linkedin\.com\/(?:in|company)\/([^/?]+)/i,
    )
    return match ? match[1].toLowerCase().replace(/[^a-z0-9\-_]+/g, '') : null
  } catch {
    return null
  }
}

// ── Completeness scoring ─────────────────────────────
function completenessScore(record: AlumniRecord): number {
  let score = 0

  // Identity fields (weight: 2)
  if (record.email && record.email.trim()) score += 2
  if (record.linkedin_url && record.linkedin_url.trim()) score += 2
  if (record.full_name && record.full_name.trim()) score += 2

  // Career fields
  if (record.company && record.company.trim()) score += 2
  if (record.role && record.role.trim()) score += 2
  if (record.industry && record.industry.trim()) score += 1
  if (record.location && record.location.trim()) score += 1

  // Rich/enrichment fields
  if (record.display_headline && record.display_headline.trim()) score += 2
  if (record.work_history && record.work_history.length > 0) score += 3
  if (record.skills && record.skills.length > 0) score += 2
  if (record.education && record.education.length > 0) score += 2
  if (record.bio && record.bio.trim()) score += 2
  if (record.advice && record.advice.trim()) score += 1
  if (record.photo_url && record.photo_url.trim()) score += 1
  if (record.avatar_url && record.avatar_url.trim()) score += 1

  // Claimed / verified rows are preferred
  if (record.is_claimed) score += 3
  if (record.is_verified) score += 2

  return score
}

// ── Fetch all alumni ─────────────────────────────────
async function fetchAllAlumni(): Promise<AlumniRecord[]> {
  const all: AlumniRecord[] = []
  let from = 0
  let total: number | null = null

  while (total === null || from < total) {
    const { data, error, count } = await supabase
      .from('alumni')
      .select(
        `id, full_name, email, linkedin_url, sport, graduation_year,
         company, role, industry, location, avatar_url, photo_url,
         display_headline, work_history, skills, education, bio, advice,
         is_claimed, is_verified, source, school_id, created_at, updated_at`,
        { count: 'exact', head: false },
      )
      .range(from, from + BATCH_SIZE - 1)
      .order('id')

    if (error) {
      console.error(`Failed to fetch alumni batch at offset ${from}: ${error.message}`)
      process.exit(1)
    }

    all.push(...(data as AlumniRecord[]))
    if (total === null) total = count ?? data?.length ?? 0
    from += BATCH_SIZE
    console.log(`  Fetched ${all.length}/${total} alumni records...`)
  }

  return all
}

// ── Find duplicates ──────────────────────────────────
function findDuplicates(records: AlumniRecord[]): DuplicatePair[] {
  const pairs: DuplicatePair[] = []
  const seen = new Set<string>() // avoid duplicating (id1,id2) pairs

  // Build lookup maps
  const byEmail = new Map<string, AlumniRecord[]>()
  const byNameSport = new Map<string, AlumniRecord[]>()
  const byNameLinkedin = new Map<string, AlumniRecord[]>()

  for (const r of records) {
    // By email
    if (r.email && r.email.trim()) {
      const key = r.email.toLowerCase().trim()
      if (!byEmail.has(key)) byEmail.set(key, [])
      byEmail.get(key)!.push(r)
    }

    // By name + sport
    if (r.full_name && r.full_name.trim() && r.sport) {
      const key = `${r.full_name.toLowerCase().trim()}||${r.sport.toLowerCase().trim()}`
      if (!byNameSport.has(key)) byNameSport.set(key, [])
      byNameSport.get(key)!.push(r)
    }

    // By name + linkedin
    if (r.full_name && r.full_name.trim() && r.linkedin_url) {
      const liUser = extractLinkedinUsername(r.linkedin_url)
      if (liUser) {
        const key = `${r.full_name.toLowerCase().trim()}||${liUser}`
        if (!byNameLinkedin.has(key)) byNameLinkedin.set(key, [])
        byNameLinkedin.get(key)!.push(r)
      }
    }
  }

  function addPair(a: AlumniRecord, b: AlumniRecord, reason: string, confidence: DuplicatePair['confidence']) {
    const key = a.id < b.id ? `${a.id}::${b.id}` : `${b.id}::${a.id}`
    if (seen.has(key)) return
    seen.add(key)
    pairs.push({
      id1: a.id < b.id ? a.id : b.id,
      id2: a.id < b.id ? b.id : a.id,
      reason,
      confidence,
    })
  }

  // Strategy A: Same email → highest confidence
  for (const [, records] of byEmail) {
    if (records.length < 2) continue
    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        addPair(records[i], records[j], 'same_email', 'highest')
      }
    }
  }

  // Strategy B: Same full_name + same sport + graduation_year within ±1 → high confidence
  for (const [, records] of byNameSport) {
    if (records.length < 2) continue
    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        const yrDiff = Math.abs(records[i].graduation_year - records[j].graduation_year)
        if (yrDiff <= 1) {
          addPair(records[i], records[j], 'same_name_sport_grad_yr', 'high')
        }
      }
    }
  }

  // Strategy C: Same full_name + same linkedin_url (partial match) → high confidence
  for (const [, records] of byNameLinkedin) {
    if (records.length < 2) continue
    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        addPair(records[i], records[j], 'same_name_linkedin', 'high')
      }
    }
  }

  return pairs
}

// ── Build transitive merge groups ────────────────────
function buildMergeGroups(pairs: DuplicatePair[]): MergeGroup[] {
  // Build adjacency
  const adj = new Map<string, Set<string>>()
  const reasonMap = new Map<string, string>() // edge id1::id2 -> reason

  for (const p of pairs) {
    if (!adj.has(p.id1)) adj.set(p.id1, new Set())
    if (!adj.has(p.id2)) adj.set(p.id2, new Set())
    adj.get(p.id1)!.add(p.id2)
    adj.get(p.id2)!.add(p.id1)
    const key = `${p.id1}::${p.id2}`
    // Keep the highest confidence reason
    if (!reasonMap.has(key) || p.confidence === 'highest') {
      reasonMap.set(key, p.reason)
    }
  }

  // BFS to find connected components
  const visited = new Set<string>()
  const groups: MergeGroup[] = []

  for (const start of adj.keys()) {
    if (visited.has(start)) continue
    const ids: string[] = []
    const queue = [start]
    visited.add(start)

    while (queue.length > 0) {
      const v = queue.shift()!
      ids.push(v)
      for (const neighbor of adj.get(v) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    // Determine the primary reason for this group
    let reason = 'multiple'
    for (const id of ids) {
      for (const otherId of ids) {
        if (id === otherId) continue
        const key = id < otherId ? `${id}::${otherId}` : `${otherId}::${id}`
        const r = reasonMap.get(key)
        if (r === 'same_email') {
          reason = 'same_email'
          break
        }
      }
      if (reason === 'same_email') break
    }
    if (reason === 'multiple') {
      // Check if all are name+sport or name+linkedin
      let allNameSport = true
      let allNameLinkedin = true
      for (const id of ids) {
        for (const otherId of ids) {
          if (id === otherId) continue
          const key = id < otherId ? `${id}::${otherId}` : `${otherId}::${id}`
          const r = reasonMap.get(key)
          if (r !== 'same_name_sport_grad_yr') allNameSport = false
          if (r !== 'same_name_linkedin') allNameLinkedin = false
        }
      }
      if (allNameSport) reason = 'same_name_sport_grad_yr'
      else if (allNameLinkedin) reason = 'same_name_linkedin'
    }

    groups.push({ ids, reason })
  }

  return groups
}

// ── Merge a single group ─────────────────────────────
async function mergeGroup(
  group: MergeGroup,
  records: Map<string, AlumniRecord>,
  apply: boolean,
): Promise<MergeReport> {
  const groupRecords = group.ids.map((id) => records.get(id)!).filter(Boolean)
  if (groupRecords.length < 2) {
    return {
      canonicalId: group.ids[0],
      mergedIds: [],
      reason: group.reason,
      canonicalScore: 0,
      mergedScore: 0,
      fieldsCopied: [],
      success: true,
      error: 'Fewer than 2 records in group (should not happen)',
    }
  }

  // Score each record
  const scored = groupRecords.map((r) => ({
    record: r,
    score: completenessScore(r),
  }))
  scored.sort((a, b) => b.score - a.score)

  const canonical = scored[0].record
  const canonicalScore = scored[0].score
  const duplicates = scored.slice(1)
  const mergedIds: string[] = []
  const fieldsCopied: string[] = []

  // Define nullable fields that can be merged
  const mergeableFields: (keyof AlumniRecord)[] = [
    'email',
    'linkedin_url',
    'company',
    'role',
    'industry',
    'location',
    'avatar_url',
    'photo_url',
    'display_headline',
    'work_history',
    'skills',
    'education',
    'bio',
    'advice',
  ]

  for (const dup of duplicates) {
    mergedIds.push(dup.record.id)

    // Check which null fields in canonical can be filled from duplicate
    const fieldsToCopy: string[] = []
    for (const field of mergeableFields) {
      const canonVal = canonical[field as string]
      const dupVal = dup.record[field as string]
      if (
        (canonVal === null || canonVal === undefined || (typeof canonVal === 'string' && canonVal.trim() === '')) &&
        dupVal !== null && dupVal !== undefined && !(typeof dupVal === 'string' && dupVal.trim() === '')
      ) {
        fieldsToCopy.push(field as unknown as string)
      }
    }

    if (fieldsToCopy.length > 0 && apply) {
      // Build update payload
      const updatePayload: Record<string, unknown> = {}
      for (const field of fieldsToCopy) {
        updatePayload[field] = dup.record[field as string]
      }
      updatePayload.updated_at = new Date().toISOString()

      try {
        const { error: updateError } = await supabase
          .from('alumni')
          .update(updatePayload)
          .eq('id', canonical.id)

        if (updateError) {
          console.warn(`  ✗ Failed to update canonical ${canonical.id}: ${updateError.message}`)
          continue
        }

        // Now delete the duplicate
        const { error: deleteError } = await supabase
          .from('alumni')
          .delete()
          .eq('id', dup.record.id)

        if (deleteError) {
          console.warn(`  ✗ Failed to delete duplicate ${dup.record.id}: ${deleteError.message}`)
        }

        fieldsCopied.push(...fieldsToCopy)
      } catch (err: any) {
        console.warn(`  ✗ Error merging duplicate ${dup.record.id}: ${err.message}`)
        continue
      }
    } else {
      fieldsCopied.push(...fieldsToCopy)
    }
  }

  return {
    canonicalId: canonical.id,
    mergedIds,
    reason: group.reason,
    canonicalScore,
    mergedScore: scored[1]?.score ?? 0,
    fieldsCopied: [...new Set(fieldsCopied)],
    success: true,
  }
}

// ── Main ─────────────────────────────────────────────
async function main() {
  const args = parseArgs()
  const mode = args.apply ? 'APPLY' : 'DRY-RUN'
  console.log(`\n╔══════════════════════════════════════════╗`)
  console.log(`║  Alumni Dedup — ${mode.padEnd(18)}║`)
  console.log(`╚══════════════════════════════════════════╝\n`)

  // Phase 1: Fetch all records
  console.log('📥 Fetching all alumni records...')
  const allRecords = await fetchAllAlumni()
  console.log(`   Total: ${allRecords.length} records\n`)

  // Phase 2: Find duplicates
  console.log('🔍 Finding potential duplicates...')
  const pairs = findDuplicates(allRecords)
  console.log(`   Found ${pairs.length} potential duplicate pair(s)\n`)

  if (pairs.length === 0) {
    console.log('✅ No duplicate alumni records found. Nothing to do.')
    return
  }

  // Group by reason for summary
  const byReason: Record<string, number> = {}
  for (const p of pairs) {
    byReason[p.reason] = (byReason[p.reason] ?? 0) + 1
  }
  console.log('   Breakdown by match reason:')
  for (const [reason, count] of Object.entries(byReason)) {
    console.log(`     ${reason}: ${count} pair(s)`)
  }
  console.log()

  // Phase 3: Build transitive groups
  console.log('📦 Computing transitive merge groups...')
  const groups = buildMergeGroups(pairs)
  console.log(`   Resolved ${groups.length} merge group(s)\n`)

  // Print groups summary
  for (const g of groups) {
    const names = g.ids.map((id) => {
      const r = allRecords.find((r) => r.id === id)
      return r ? `${r.full_name} (${r.id.slice(0, 8)}...)` : id.slice(0, 8)
    })
    console.log(`   Group [${g.reason}]: ${names.join(', ')}`)
  }
  console.log()

  // Build record map for fast lookup
  const recordMap = new Map<string, AlumniRecord>()
  for (const r of allRecords) {
    recordMap.set(r.id, r)
  }

  // Phase 4: Merge each group
  console.log(`🔄 ${args.apply ? 'Merging' : 'Simulating'} duplicate groups...\n`)

  const reports: MergeReport[] = []
  for (const group of groups) {
    try {
      const report = await mergeGroup(group, recordMap, args.apply)
      reports.push(report)

      const names = group.ids.map((id) => {
        const r = recordMap.get(id)
        return r ? r.full_name : id.slice(0, 8)
      })

      console.log(`   Group: [${names.join(', ')}]`)
      console.log(`     Reason:        ${report.reason}`)
      console.log(`     Canonical:     ${report.canonicalId} (score: ${report.canonicalScore})`)
      console.log(`     Merged:        ${report.mergedIds.length} record(s)`)
      if (report.fieldsCopied.length > 0) {
        console.log(`     Fields copied: ${report.fieldsCopied.join(', ')}`)
      }
      if (report.error) {
        console.log(`     Note:          ${report.error}`)
      }
      console.log()
    } catch (err: any) {
      console.error(`   ✗ Group merge failed: ${err.message}\n`)
      reports.push({
        canonicalId: group.ids[0],
        mergedIds: group.ids.slice(1),
        reason: group.reason,
        canonicalScore: 0,
        mergedScore: 0,
        fieldsCopied: [],
        success: false,
        error: err.message,
      })
    }
  }

  // Phase 5: Summary report
  const totalKept = reports.filter((r) => r.success).length
  const totalMerged = reports.reduce((sum, r) => sum + r.mergedIds.length, 0)
  const totalFailed = reports.filter((r) => !r.success).length

  console.log(`╔══════════════════════════════════════════════════════╗`)
  console.log(`║                    MERGE REPORT                      ║`)
  console.log(`╚══════════════════════════════════════════════════════╝`)
  console.log(`  Mode:          ${mode}`)
  console.log(`  Groups found:  ${groups.length}`)
  console.log(`  Records kept:  ${totalKept}`)
  console.log(`  Records merged: ${totalMerged}`)
  console.log(`  Failures:      ${totalFailed}`)

  if (totalFailed > 0) {
    console.log(`\n  Failed groups:`)
    for (const r of reports) {
      if (!r.success) {
        console.log(`    - ${r.canonicalId}: ${r.error}`)
      }
    }
  }

  if (!args.apply) {
    console.log(`\n⚠️  DRY-RUN — no changes were applied.`)
    console.log(`   Run with --apply to commit the merges.`)
  } else {
    console.log(`\n✅ Done. Merged ${totalMerged} duplicate record(s) into ${totalKept} canonical record(s).`)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
