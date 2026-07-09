/**
 * Alumni enrichment — the shared engine used by both the admin route (manual,
 * fill-only) and the incremental cron (scheduled, refresh-capable). The pure
 * write decision lives in ./enrichmentPolicy; this file does the I/O:
 * Claude inference + DB writes + freshness stamping.
 *
 * Nothing here runs without ANTHROPIC_API_KEY + a service-role Supabase client.
 * The enrichment *source* is Claude inference from the LinkedIn URL slug today;
 * a real-search source (Serper) can drop in behind the same interface later.
 */
import Anthropic from '@anthropic-ai/sdk'
import { decideField, type EnrichMode } from './enrichmentPolicy'

const DAY_MS = 86_400_000
export const BATCH_SIZE = 25
export const CONFIDENCE_THRESHOLD = 0.75 // legacy fill bar (policy owns the real gates)
const INTER_BATCH_DELAY_MS = 600

export const GARBAGE_VALUES = new Set(['...', '-', '--', 'n/a', 'na', 'none', 'unknown', 'null'])

export function extractLinkedInSlug(url: string | null): string | null {
  if (!url) return null
  try {
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

export function isGarbage(value: string | null | undefined): boolean {
  if (!value) return true
  return GARBAGE_VALUES.has(value.trim().toLowerCase())
}

export interface AlumniForEnrichment {
  id: string
  full_name: string
  role: string | null
  company: string | null
  location: string | null
  sport: string
  graduation_year: number
  linkedin_url: string | null
  enriched_at?: string | null
}

export interface EnrichmentResult {
  id: string
  role: string | null
  company: string | null
  confidence: number
  reasoning: string
}

/** Claude inference from name / sport / year / location / LinkedIn slug. */
export async function enrichWithClaude(
  anthropic: Anthropic,
  batch: AlumniForEnrichment[],
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
- LinkedIn URL slug: often encodes name + employer or role (e.g. "jane-doe-jpmorgan" -> JPMorgan, "john-smith-software-engineer" -> Software Engineer). Ignore random hashes (like "ab1234").
- Sport + graduation year: suggests career stage and sometimes career path.
- Location: can narrow down employer.
- Name: some names are common in specific industries.

Be honest about confidence:
- 0.9+ : strong signal in the slug (e.g. slug contains recognizable company name)
- 0.75-0.9: moderate signal (location + sport pattern + partial slug hint)
- below 0.75: too speculative -- set role/company to null

Only fill in fields that are actually missing. If a field is already known, do not change it.

Alumni to enrich:
${alumniList}

Respond with ONLY a JSON array. Each object must have:
- "index": 1-based integer
- "role": string or null (job title, e.g. "Analyst", "Software Engineer", "Associate")
- "company": string or null (company name only, no "at" prefix)
- "confidence": float 0-1
- "reasoning": one sentence explaining your inference

Return ONLY the JSON array.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')
    const raw = content.text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const parsed: { index: number; role: string | null; company: string | null; confidence: number; reasoning: string }[] = JSON.parse(raw)
    for (const item of parsed) {
      const idx = item.index - 1
      if (idx < 0 || idx >= batch.length) continue
      const alumni = batch[idx]
      results.set(alumni.id, {
        id: alumni.id,
        role: item.role?.trim() || null,
        company: item.company?.trim() || null,
        confidence: item.confidence ?? 0,
        reasoning: item.reasoning ?? '',
      })
    }
  } catch (error) {
    console.error('[enrichAlumni] Claude error:', error)
  }
  return results
}

/** Null out known garbage values in role/company/location. */
export async function runCleanup(supabase: any) {
  const garbageList = [...GARBAGE_VALUES]
  const stats: Record<string, number> = {}
  for (const field of ['role', 'company', 'location'] as const) {
    const { count } = await supabase.from('alumni').select('id', { count: 'exact', head: true }).in(field, garbageList)
    if ((count ?? 0) > 0) await supabase.from('alumni').update({ [field]: null }).in(field, garbageList)
    stats[`${field}Cleaned`] = count ?? 0
  }
  return stats
}

export interface ApplyStats {
  candidates: number
  written: number
  skipped: number
  sampleEnriched: Array<{ name: string; role: string | null; company: string | null; confidence: number; mode: EnrichMode }>
  sampleSkipped: Array<{ name: string; reason: string }>
}

/**
 * Enrich a set of candidates through Claude, apply the fill/refresh policy per
 * field, write updates, and stamp enriched_at + enrichment_confidence so the
 * incremental cron doesn't re-hit the same rows next run.
 */
export async function applyEnrichment(
  supabase: any,
  anthropic: Anthropic,
  candidates: AlumniForEnrichment[],
  opts: { mode: EnrichMode; nowMs?: number },
): Promise<ApplyStats> {
  const { mode } = opts
  const nowMs = opts.nowMs ?? Date.now()
  const stampIso = new Date(nowMs).toISOString()
  const enriched: ApplyStats['sampleEnriched'] = []
  const skipped: ApplyStats['sampleSkipped'] = []
  let written = 0

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    const results = await enrichWithClaude(anthropic, batch)

    for (const alum of batch) {
      const result = results.get(alum.id)
      if (!result) { skipped.push({ name: alum.full_name, reason: 'no result from Claude (retried next run)' }); continue }

      const daysSince = alum.enriched_at ? Math.max(0, (nowMs - Date.parse(alum.enriched_at)) / DAY_MS) : 3650
      const update: Record<string, unknown> = {}

      const roleDec = decideField(alum.role, result.role, result.confidence, mode, daysSince)
      if (roleDec.write) update.role = result.role
      const compDec = decideField(alum.company, result.company, result.confidence, mode, daysSince)
      if (compDec.write) update.company = result.company

      // Always stamp freshness (we got a valid inference), so the row rests before its next attempt.
      update.enriched_at = stampIso
      update.enrichment_confidence = result.confidence

      const { error } = await supabase.from('alumni').update(update).eq('id', alum.id)
      if (error) { skipped.push({ name: alum.full_name, reason: `DB error: ${error.message}` }); continue }

      if (roleDec.write || compDec.write) {
        written++
        if (enriched.length < 50) enriched.push({ name: alum.full_name, role: roleDec.write ? result.role : null, company: compDec.write ? result.company : null, confidence: result.confidence, mode })
      } else if (skipped.length < 30) {
        skipped.push({ name: alum.full_name, reason: `${roleDec.reason} / ${compDec.reason}` })
      }
    }

    if (i + BATCH_SIZE < candidates.length) await new Promise(r => setTimeout(r, INTER_BATCH_DELAY_MS))
  }

  return { candidates: candidates.length, written, skipped: skipped.length, sampleEnriched: enriched, sampleSkipped: skipped.slice(0, 30) }
}
