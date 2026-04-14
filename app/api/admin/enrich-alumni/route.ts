import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

// ─── Config ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 25           // alumni per Claude call
const CONFIDENCE_THRESHOLD = 0.75  // only write back inferences above this
const INTER_BATCH_DELAY_MS = 600   // be polite to the Claude API

// Garbage values to null out in Phase 1
const GARBAGE_VALUES = new Set(['...', '-', '--', 'n/a', 'na', 'none', 'unknown', 'null'])

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the path slug from a LinkedIn URL.
 *  e.g. "https://linkedin.com/in/john-smith-goldman-sachs" → "john-smith-goldman-sachs"
 */
function extractLinkedInSlug(url: string | null): string | null {
  if (!url) return null
  try {
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

/** True if a field value is meaningful (not null/garbage). */
function isGarbage(value: string | null | undefined): boolean {
  if (!value) return true
  return GARBAGE_VALUES.has(value.trim().toLowerCase())
}

// ─── Claude enrichment ───────────────────────────────────────────────────────

interface AlumniForEnrichment {
  id: string
  full_name: string
  role: string | null
  company: string | null
  location: string | null
  sport: string
  graduation_year: number
  linkedin_url: string | null
}

interface EnrichmentResult {
  id: string
  role: string | null
  company: string | null
  confidence: number
  reasoning: string
}

async function enrichWithClaude(
  anthropic: Anthropic,
  batch: AlumniForEnrichment[]
): Promise<Map<string, EnrichmentResult>> {
  const results = new Map<string, EnrichmentResult>()

  const alumniList = batch.map((a, i) => {
    const slug = extractLinkedInSlug(a.linkedin_url)
    return [
      `${i + 1}. Name: ${a.full_name}`,
      `   Sport: ${a.sport}, Class of ${a.graduation_year}`,
      slug ? `   LinkedIn slug: "${slug}"` : '',
      a.location ? `   Location: ${a.location}` : '',
      a.role && !isGarbage(a.role) ? `   Known role: ${a.role}` : '   Role: missing',
      a.company && !isGarbage(a.company) ? `   Known company: ${a.company}` : '   Company: missing',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const prompt = `You are enriching a database of Cornell University athlete alumni. For each person, infer their most likely current job role and/or company using all available signals.

Key signals to use:
- LinkedIn URL slug: often encodes name + employer or role (e.g. "jane-doe-jpmorgan" → JPMorgan, "john-smith-software-engineer" → Software Engineer). Ignore random hashes (like "ab1234").
- Sport + graduation year: suggests career stage and sometimes career path (e.g., rowing + 2015 might suggest finance/consulting; football + 2010 might suggest coaching or business)
- Location: can narrow down employer (e.g., New York + Finance background → Wall Street firms)
- Name: some names are common in specific industries

Be honest about confidence:
- 0.9+ : strong signal in the slug (e.g. slug contains recognizable company name)
- 0.75–0.9: moderate signal (location + sport pattern + partial slug hint)
- below 0.75: too speculative — set role/company to null

Only fill in fields that are actually missing. If a field is already known, do not change it.

Alumni to enrich:
${alumniList}

Respond with ONLY a JSON array. Each object must have:
- "index": 1-based integer
- "role": string or null (job title, e.g. "Analyst", "Software Engineer", "Associate")
- "company": string or null (company name only, no "at" prefix)
- "confidence": float 0–1
- "reasoning": one sentence explaining your inference

Example:
[
  {"index": 1, "role": "Analyst", "company": "Goldman Sachs", "confidence": 0.88, "reasoning": "Slug 'jane-doe-goldman-sachs' clearly encodes the employer."},
  {"index": 2, "role": null, "company": null, "confidence": 0.3, "reasoning": "Slug is just a name with no employer signal."}
]

Return ONLY the JSON array.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    // Strip markdown code fences if present
    const raw = content.text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const parsed: { index: number; role: string | null; company: string | null; confidence: number; reasoning: string }[] = JSON.parse(raw)

    for (const item of parsed) {
      const alumniIndex = item.index - 1
      if (alumniIndex < 0 || alumniIndex >= batch.length) continue

      const alumni = batch[alumniIndex]
      results.set(alumni.id, {
        id: alumni.id,
        role: item.role?.trim() || null,
        company: item.company?.trim() || null,
        confidence: item.confidence ?? 0,
        reasoning: item.reasoning ?? '',
      })
    }
  } catch (error) {
    console.error('Claude enrichment error:', error)
    // On error, return empty (no changes for this batch)
  }

  return results
}

// ─── Phase 1: Cleanup ────────────────────────────────────────────────────────

async function runCleanup(supabase: any) {
  // Build a filter for rows containing garbage values
  const garbageList = [...GARBAGE_VALUES]

  // role cleanup
  const { count: roleCount } = await supabase
    .from('alumni')
    .select('id', { count: 'exact', head: true })
    .in('role', garbageList)

  if ((roleCount ?? 0) > 0) {
    await supabase.from('alumni').update({ role: null }).in('role', garbageList)
  }

  // company cleanup
  const { count: companyCount } = await supabase
    .from('alumni')
    .select('id', { count: 'exact', head: true })
    .in('company', garbageList)

  if ((companyCount ?? 0) > 0) {
    await supabase.from('alumni').update({ company: null }).in('company', garbageList)
  }

  // location cleanup
  const { count: locationCount } = await supabase
    .from('alumni')
    .select('id', { count: 'exact', head: true })
    .in('location', garbageList)

  if ((locationCount ?? 0) > 0) {
    await supabase.from('alumni').update({ location: null }).in('location', garbageList)
  }

  return {
    rolesCleaned: roleCount ?? 0,
    companiesCleaned: companyCount ?? 0,
    locationsCleaned: locationCount ?? 0,
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

function authCheck(request: Request): boolean {
  const { searchParams } = new URL(request.url)
  const adminKey = searchParams.get('key')
  const token = process.env.ADMIN_API_TOKEN
  if (!token || token.length < 32) return false
  return adminKey === token
}

/** POST: run cleanup + enrichment */
export async function POST(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') ?? 'both'     // 'cleanup' | 'enrich' | 'both'
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam) : 5000

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const report: Record<string, unknown> = {}

  // ── Phase 1: Cleanup ──────────────────────────────────────────────────────
  if (mode === 'cleanup' || mode === 'both') {
    const cleanupStats = await runCleanup(supabase)
    report.cleanup = cleanupStats
  }

  // ── Phase 2: Enrichment ───────────────────────────────────────────────────
  if (mode === 'enrich' || mode === 'both') {
    // Target: alumni with a LinkedIn URL but missing role OR company
    const { data: candidates, error: fetchError } = await supabase
      .from('alumni')
      .select('id, full_name, role, company, location, sport, graduation_year, linkedin_url')
      .not('linkedin_url', 'is', null)
      .or('role.is.null,company.is.null')
      .limit(limit)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const enriched: { name: string; role: string | null; company: string | null; confidence: number; reasoning: string }[] = []
    const skipped: { name: string; reason: string }[] = []
    let written = 0

    for (let i = 0; i < (candidates?.length ?? 0); i += BATCH_SIZE) {
      const batch = (candidates ?? []).slice(i, i + BATCH_SIZE) as AlumniForEnrichment[]
      const results = await enrichWithClaude(anthropic, batch)

      for (const alumni of batch) {
        const result = results.get(alumni.id)

        if (!result) {
          skipped.push({ name: alumni.full_name, reason: 'No result from Claude' })
          continue
        }

        if (result.confidence < CONFIDENCE_THRESHOLD) {
          skipped.push({ name: alumni.full_name, reason: `Low confidence (${result.confidence.toFixed(2)}): ${result.reasoning}` })
          continue
        }

        // Build update: only overwrite fields that are currently null/missing
        const update: { role?: string; company?: string } = {}
        if (!alumni.role && result.role) update.role = result.role
        if (!alumni.company && result.company) update.company = result.company

        if (Object.keys(update).length === 0) {
          skipped.push({ name: alumni.full_name, reason: 'No new fields to fill in' })
          continue
        }

        const { error: updateError } = await supabase
          .from('alumni')
          .update(update)
          .eq('id', alumni.id)

        if (updateError) {
          skipped.push({ name: alumni.full_name, reason: `DB error: ${updateError.message}` })
          continue
        }

        enriched.push({
          name: alumni.full_name,
          role: result.role,
          company: result.company,
          confidence: result.confidence,
          reasoning: result.reasoning,
        })
        written++
      }

      if (i + BATCH_SIZE < (candidates?.length ?? 0)) {
        await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY_MS))
      }
    }

    report.enrichment = {
      candidates: candidates?.length ?? 0,
      written,
      skipped: skipped.length,
      confidenceThreshold: CONFIDENCE_THRESHOLD,
      sampleEnriched: enriched.slice(0, 50),
      sampleSkipped: skipped.slice(0, 30),
    }
  }

  return NextResponse.json({ success: true, ...report })
}

/** GET: dry run — preview what would change without writing */
export async function GET(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Count cleanup targets
  const garbageList = [...GARBAGE_VALUES]
  const [{ count: dirtyRoles }, { count: dirtyCompanies }, { count: dirtyLocations }] = await Promise.all([
    supabase.from('alumni').select('id', { count: 'exact', head: true }).in('role', garbageList),
    supabase.from('alumni').select('id', { count: 'exact', head: true }).in('company', garbageList),
    supabase.from('alumni').select('id', { count: 'exact', head: true }).in('location', garbageList),
  ])

  // Count enrichment candidates
  const { count: candidateCount } = await supabase
    .from('alumni')
    .select('id', { count: 'exact', head: true })
    .not('linkedin_url', 'is', null)
    .or('role.is.null,company.is.null')

  // Preview enrichment on a small sample
  const { data: sample } = await supabase
    .from('alumni')
    .select('id, full_name, role, company, location, sport, graduation_year, linkedin_url')
    .not('linkedin_url', 'is', null)
    .or('role.is.null,company.is.null')
    .limit(limit)

  const preview: unknown[] = []

  if (sample && sample.length > 0) {
    for (let i = 0; i < sample.length; i += BATCH_SIZE) {
      const batch = sample.slice(i, i + BATCH_SIZE) as AlumniForEnrichment[]
      const results = await enrichWithClaude(anthropic, batch)

      for (const alumni of batch) {
        const result = results.get(alumni.id)
        preview.push({
          name: alumni.full_name,
          sport: alumni.sport,
          year: alumni.graduation_year,
          linkedinSlug: extractLinkedInSlug(alumni.linkedin_url),
          currentRole: alumni.role,
          currentCompany: alumni.company,
          inferredRole: result?.role ?? null,
          inferredCompany: result?.company ?? null,
          confidence: result?.confidence ?? 0,
          reasoning: result?.reasoning ?? '',
          wouldWrite: (result?.confidence ?? 0) >= CONFIDENCE_THRESHOLD,
        })
      }
    }
  }

  return NextResponse.json({
    dryRun: true,
    cleanup: {
      dirtyRoles: dirtyRoles ?? 0,
      dirtyCompanies: dirtyCompanies ?? 0,
      dirtyLocations: dirtyLocations ?? 0,
    },
    enrichment: {
      totalCandidates: candidateCount ?? 0,
      previewSample: limit,
      wouldWrite: preview.filter((p: any) => p.wouldWrite).length,
      wouldSkip: preview.filter((p: any) => !p.wouldWrite).length,
      preview,
    },
  })
}
