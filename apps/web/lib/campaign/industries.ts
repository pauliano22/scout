// The real corpus industry taxonomy — the ONLY industries the goal step offers.
// Offering exactly these (instead of free text) is what stops an out-of-taxonomy
// slice like "Startups" from silently degrading to similarity-only sourcing.
// Counts (approx, prod corpus): Finance 765 · Technology 867 · Consulting 333 ·
// Healthcare 616 · Law 226 · Media 131.
export const CORPUS_INDUSTRIES = ['Finance', 'Technology', 'Consulting', 'Healthcare', 'Law', 'Media'] as const
export type CorpusIndustry = (typeof CORPUS_INDUSTRIES)[number]

export function isValidIndustry(x: string | null | undefined): x is CorpusIndustry {
  return !!x && (CORPUS_INDUSTRIES as readonly string[]).includes(x)
}

export type CoverageTier = 'healthy' | 'moderate' | 'thin'
export const COVERAGE_HEALTHY = 30
export const COVERAGE_MODERATE = 8

/** Tier a gate-passing alumni count for the goal-setting coverage hint. */
export function coverageTier(count: number): CoverageTier {
  if (count >= COVERAGE_HEALTHY) return 'healthy'
  if (count >= COVERAGE_MODERATE) return 'moderate'
  return 'thin'
}
