/**
 * Alumni freshness engine — the pure decision layer.
 *
 * Two modes:
 *  - `fill`    : only populate EMPTY fields (the current one-off behaviour).
 *  - `refresh` : also UPDATE a field that already has a value, but only when the
 *                row is stale AND the new inference clears a higher confidence bar,
 *                so we never overwrite good data with a worse guess.
 *
 * No I/O, no keys, no Claude — this is the part we can unit-test and reason about.
 * The enrichment *source* (slug inference today, real search later) plugs in
 * separately and just hands us (value, confidence) per field.
 */

export type EnrichMode = 'fill' | 'refresh'

/** Minimum confidence to write an inference into an EMPTY field. */
export const FILL_MIN_CONFIDENCE = 0.75
/** Higher bar to OVERWRITE a field that already has a value. */
export const REFRESH_MIN_CONFIDENCE = 0.85
/** A populated field is only eligible for refresh once it's this old. */
export const REFRESH_STALE_DAYS = 180

export interface FieldDecision {
  write: boolean
  reason: string
}

const DAY_MS = 86_400_000

function norm(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

/**
 * Decide whether one inferred field value should be written.
 * `daysSinceEnriched` = age of the row's last enrichment (large when never enriched).
 */
export function decideField(
  current: string | null | undefined,
  inferred: string | null | undefined,
  confidence: number,
  mode: EnrichMode,
  daysSinceEnriched: number,
): FieldDecision {
  if (!inferred || !inferred.trim()) return { write: false, reason: 'no inference' }

  const isEmpty = !current || !current.trim()
  if (isEmpty) {
    return confidence >= FILL_MIN_CONFIDENCE
      ? { write: true, reason: 'fill empty' }
      : { write: false, reason: `below fill bar (${confidence.toFixed(2)} < ${FILL_MIN_CONFIDENCE})` }
  }

  // Field already has a value.
  if (mode === 'fill') return { write: false, reason: 'fill mode: field already set' }
  if (norm(current) === norm(inferred)) return { write: false, reason: 'unchanged' }
  if (daysSinceEnriched < REFRESH_STALE_DAYS) return { write: false, reason: 'not stale yet' }
  return confidence >= REFRESH_MIN_CONFIDENCE
    ? { write: true, reason: 'refresh stale, high confidence' }
    : { write: false, reason: `refresh needs ≥${REFRESH_MIN_CONFIDENCE} (${confidence.toFixed(2)})` }
}

/**
 * Priority score for a bounded run — higher = enrich sooner. Most-incomplete rows
 * dominate; among equally complete rows, the stalest (oldest / never enriched) wins.
 * `nowMs` is injected for deterministic testing.
 */
export function enrichmentPriority(
  row: { role: string | null; company: string | null; enriched_at?: string | null },
  nowMs: number,
): number {
  const missing = (row.role && row.role.trim() ? 0 : 1) + (row.company && row.company.trim() ? 0 : 1) // 0..2
  const ageDays = row.enriched_at
    ? Math.max(0, (nowMs - Date.parse(row.enriched_at)) / DAY_MS)
    : 3650 // never enriched -> treat as very old
  return missing * 10_000 + Math.min(ageDays, 3650)
}
