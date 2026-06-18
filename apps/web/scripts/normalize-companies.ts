#!/usr/bin/env npx tsx
/**
 * Company Name Normalization Script
 *
 * Queries all distinct company names from the profiles and alumni tables,
 * runs each through normalizeCompany(), and prints a summary report.
 *
 * Usage:
 *   npx tsx scripts/normalize-companies.ts            # dry-run (default)
 *   npx tsx scripts/normalize-companies.ts --dry-run   # explicit dry-run
 *   npx tsx scripts/normalize-companies.ts --apply     # insert canonical mappings into DB
 *
 * Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

import { normalizeCompany, buildAliasMap } from '../lib/companies'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

config({ path: '.env.local' })
config({ path: '.env' })

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
  process.exit(1)
}

const supabase = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

if (!supabase) {
  console.warn('⚠  SUPABASE_SERVICE_ROLE_KEY not set — running in local-only mode (no DB queries)')
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run') || !args.includes('--apply')
const shouldApply = args.includes('--apply')

if (shouldApply) {
  console.log('🔧 Mode: APPLY — canonical mappings will be inserted into the database')
} else {
  console.log('🔍 Mode: DRY-RUN (use --apply to insert mappings into the DB)')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface CompanyRow {
  company: string | null
  source: 'profiles' | 'alumni' | 'opportunities'
}

async function fetchDistinctCompanies(): Promise<CompanyRow[]> {
  if (!supabase) return []

  const rows: CompanyRow[] = []

  // Profiles
  const { data: profiles, error: err1 } = await supabase
    .from('profiles')
    .select('company')
    .not('company', 'is', null)
    .neq('company', '')

  if (err1) {
    console.warn(`⚠  Failed to fetch profiles: ${err1.message}`)
  } else {
    for (const r of profiles ?? []) {
      if (r.company) rows.push({ company: r.company, source: 'profiles' })
    }
  }

  // Alumni
  const { data: alumni, error: err2 } = await supabase
    .from('alumni')
    .select('company')
    .not('company', 'is', null)
    .neq('company', '')

  if (err2) {
    console.warn(`⚠  Failed to fetch alumni: ${err2.message}`)
  } else {
    for (const r of alumni ?? []) {
      if (r.company) rows.push({ company: r.company, source: 'alumni' })
    }
  }

  // Opportunities
  const { data: opps, error: err3 } = await supabase
    .from('opportunities')
    .select('company')
    .not('company', 'is', null)
    .neq('company', '')

  if (err3) {
    console.warn(`⚠  Failed to fetch opportunities: ${err3.message}`)
  } else {
    for (const r of opps ?? []) {
      if (r.company) rows.push({ company: r.company, source: 'opportunities' })
    }
  }

  return rows
}

interface MatchEntry {
  raw: string
  canonical: string
  industry: string
  confidence: number
  sources: Set<string>
}

async function main() {
  // 1. Show canonical catalog stats
  const aliasMap = buildAliasMap()
  const { CANONICAL_COMPANIES } = await import('../lib/companies')
  console.log(`\n📋 Canonical catalog: ${CANONICAL_COMPANIES.length} entries, ${aliasMap.size} total aliases`)
  console.log('   Industries covered:', [...new Set(CANONICAL_COMPANIES.map((c) => c.industry))].join(', '))

  // 2. Fetch company names from DB (or use sample data if no DB)
  let rawCompanies: CompanyRow[]

  if (supabase) {
    rawCompanies = await fetchDistinctCompanies()
    console.log(`\n📊 Found ${rawCompanies.length} raw company entries across all tables`)
  } else {
    // Sample data for demonstration
    rawCompanies = [
      { company: 'Goldman Sachs', source: 'alumni' },
      { company: 'Goldman Sachs & Co.', source: 'profiles' },
      { company: 'Citi', source: 'alumni' },
      { company: 'Citigroup Inc.', source: 'alumni' },
      { company: 'Morgan Stanley', source: 'profiles' },
      { company: 'McKinsey & Company', source: 'alumni' },
      { company: 'McKinsey', source: 'profiles' },
      { company: 'Boston Consulting Group', source: 'alumni' },
      { company: 'BCG', source: 'profiles' },
      { company: 'Google', source: 'alumni' },
      { company: 'Alphabet', source: 'profiles' },
      { company: 'Meta Platforms Inc.', source: 'alumni' },
      { company: 'Facebook', source: 'profiles' },
      { company: 'Amazon Web Services', source: 'alumni' },
      { company: 'JPMorgan Chase & Co.', source: 'alumni' },
      { company: 'JP Morgan', source: 'profiles' },
      { company: 'Deloitte', source: 'alumni' },
      { company: 'PwC', source: 'profiles' },
      { company: 'Ernst & Young LLP', source: 'alumni' },
      { company: 'EY', source: 'profiles' },
      { company: 'KPMG LLP', source: 'alumni' },
      { company: 'Accenture', source: 'profiles' },
      { company: 'Bain & Company', source: 'alumni' },
      { company: 'Bain', source: 'profiles' },
      { company: 'Nike', source: 'alumni' },
      { company: 'Cornell University', source: 'alumni' },
      { company: 'Cornell', source: 'profiles' },
      { company: 'Some Unknown Startup', source: 'profiles' },
      { company: 'Local Hospital NY', source: 'alumni' },
    ]
    console.log(`\n📊 Using ${rawCompanies.length} sample company entries (no DB connection)`)
  }

  // 3. Deduplicate by company name for reporting (keep first source)
  const seenCompanies = new Map<string, Set<string>>()
  for (const rc of rawCompanies) {
    const key = (rc.company ?? '').trim().toLowerCase()
    if (key) {
      if (!seenCompanies.has(key)) {
        seenCompanies.set(key, new Set())
      }
      seenCompanies.get(key)!.add(rc.source)
    }
  }

  const uniqueCompanies = Array.from(seenCompanies.entries()).map(
    ([key, sources]) => ({ raw: key, sources })
  )

  console.log(`\n📝 Normalizing ${uniqueCompanies.length} unique company names...`)

  // 4. Run normalization
  const matched: MatchEntry[] = []
  const unmatched: Array<{ raw: string; sources: Set<string> }> = []
  const industryCounts = new Map<string, number>()
  let total = 0

  for (const { raw, sources } of uniqueCompanies) {
    total++
    const result = normalizeCompany(raw)

    if (result.confidence > 0 && result.industry !== 'Other') {
      const existing = matched.find(
        (m) => m.canonical === result.canonicalName && m.industry === result.industry
      )
      if (existing) {
        // Merge sources
        for (const s of sources) existing.sources.add(s)
      } else {
        matched.push({
          raw,
          canonical: result.canonicalName,
          industry: result.industry,
          confidence: result.confidence,
          sources: new Set(sources),
        })
      }
      industryCounts.set(
        result.industry,
        (industryCounts.get(result.industry) ?? 0) + 1
      )
    } else {
      unmatched.push({ raw, sources })
    }
  }

  // 5. Print summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('  NORMALIZATION SUMMARY')
  console.log(`${'='.repeat(60)}`)
  console.log(`  Total unique names:    ${total}`)
  console.log(`  Matched:               ${matched.length} (${((matched.length / total) * 100).toFixed(1)}%)`)
  console.log(`  Unmatched:             ${unmatched.length} (${((unmatched.length / total) * 100).toFixed(1)}%)`)
  console.log(`  Industries covered:    ${industryCounts.size}`)
  console.log()

  // Industry breakdown
  console.log('  ── Industry Breakdown ──')
  const sortedIndustries = Array.from(industryCounts.entries()).sort((a, b) => b[1] - a[1])
  for (const [industry, count] of sortedIndustries) {
    console.log(`    ${industry.padEnd(25)} ${count}`)
  }
  console.log()

  // Matched details
  console.log('  ── Matched Companies ──')
  const sortedMatched = [...matched].sort((a, b) => b.confidence - a.confidence)
  for (const m of sortedMatched) {
    const pct = (m.confidence * 100).toFixed(0)
    const sources = Array.from(m.sources).join(', ')
    console.log(`    ✓ "${m.raw}" → ${m.canonical} [${m.industry}] (${pct}%) [${sources}]`)
  }
  console.log()

  // Unmatched details
  if (unmatched.length > 0) {
    console.log('  ── Unmatched Companies ──')
    for (const u of unmatched) {
      const sources = Array.from(u.sources).join(', ')
      console.log(`    ✗ "${u.raw}" [${sources}]`)
    }
    console.log()
  }

  // 6. Apply mode: insert into DB
  if (shouldApply && supabase) {
    console.log('  ── Inserting canonical mappings into database ──')

    let inserted = 0
    let errors = 0

    for (const m of matched) {
      // Insert into company_aliases
      const { error: aliasErr } = await supabase.from('company_aliases').upsert(
        {
          canonical_name: m.canonical,
          alias: m.raw,
        },
        { onConflict: 'alias', ignoreDuplicates: false }
      )

      if (aliasErr) {
        console.warn(`    ⚠ Error inserting alias "${m.raw}": ${aliasErr.message}`)
        errors++
      } else {
        inserted++
      }
    }

    console.log(`\n  ✅ Inserted/updated ${inserted} aliases (${errors} errors)`)

    // Also insert canonical names as self-aliases where missing
    const canonicalNames = [...new Set(matched.map((m) => m.canonical))]
    let canonInserted = 0
    for (const name of canonicalNames) {
      const { error } = await supabase.from('company_aliases').upsert(
        { canonical_name: name, alias: name },
        { onConflict: 'alias', ignoreDuplicates: true }
      )
      if (!error) canonInserted++
    }
    console.log(`  ✅ Inserted ${canonInserted} canonical self-aliases`)
  } else if (shouldApply && !supabase) {
    console.log('\n  ⚠ Cannot apply without a valid Supabase service role key.')
    console.log('     Set SUPABASE_SERVICE_ROLE_KEY and try again.')
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('  Done.')
  console.log(`${'='.repeat(60)}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
