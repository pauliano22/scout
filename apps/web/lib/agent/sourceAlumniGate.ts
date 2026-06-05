// Pure sourcing-gate logic — NO I/O (no Supabase, OpenAI, Next). Extracted from
// sourceAlumni so it is unit-testable without API keys (see
// evals/agent/sourceAlumniGate.eval.ts). This is the "works for ALL searches"
// guarantee: the abstain hook + the HIGH-confidence decision are DETERMINISTIC
// and locked by fixtures, independent of the LLM's per-run judgement (which was
// inconsistent on location — the bug the adversarial judges caught).

import { industryMatchStrength, type UserPreferences } from '@scout/shared/scoring/recommendationScoring'
import type { Alumni } from '@scout/shared/types/database'

// Strings present as a "company" but carrying no signal — not a real, nameable
// employer to personalize on. "Stealth Startup" & co. must NOT satisfy the hook.
export const PLACEHOLDER_COMPANIES = new Set([
  'stealth', 'stealth startup', 'stealth mode', 'stealth co', 'startup', 'a startup', 'my startup',
  'self-employed', 'self employed', 'freelance', 'freelancer', 'independent', 'independent consultant',
  'consultant', 'n/a', 'na', 'none', 'private', 'confidential', 'various', 'undisclosed', 'tbd', 'unknown',
])

export function normCompany(c: string | null): string {
  return (c ?? '').trim().toLowerCase().replace(/\s*\(yc[^)]*\)\s*$/i, '').trim()
}

// Non-employer "company" strings — charity drives, volunteer activities, etc.
// These pass the literal-placeholder check but are NOT real employers, so they
// must not back a HIGH match (the "Cornell Adopt-A-Family Christmas Drive" case).
// Phrases are specific so real firms ("Drive Capital", "Club Capital") survive.
const NON_EMPLOYER_RE = /\b(adopt[- ]a[- ]family|christmas drive|toy drive|food drive|blood drive|canned[- ]food|fundraiser|fund drive|volunteer|intramural)\b/i

export function isRealCompany(c: string | null): boolean {
  if (!c) return false
  if (NON_EMPLOYER_RE.test(c)) return false
  const n = normCompany(c)
  return n.length >= 2 && !PLACEHOLDER_COMPANIES.has(n)
}

// ── Metro-aware location matching ───────────────────────────────────────────
// A student's target city should match its metro (Cambridge≈Boston, Rye≈NYC,
// Mountain View≈SF Bay), and must do so CONSISTENTLY for every candidate — the
// LLM applied this unevenly (NY leaked into an SF search, Chicago didn't).
const METRO_ALIASES: Record<string, string[]> = {
  // Conservative metro: NYC proper + boroughs + immediate NJ (Hoboken/JC/Newark
  // are across-the-river commuter core). Westchester/CT exurbs (Rye, White Plains,
  // Stamford, Greenwich) are deliberately EXCLUDED — counting them as NYC let
  // suburb rows outrank disclosed out-of-city ones (the adversarial-audit finding).
  // Metro radius is a documented, tunable policy decision (see PR "eyes on").
  'new york': ['new york', 'nyc', 'n.y.', 'new york city', 'brooklyn', 'manhattan', 'queens', 'bronx', 'jersey city', 'newark', 'hoboken', 'long island city'],
  'san francisco': ['san francisco', 'sf', 'bay area', 'silicon valley', 'mountain view', 'palo alto', 'menlo park', 'oakland', 'berkeley', 'san jose', 'sunnyvale', 'redwood city', 'cupertino', 'santa clara'],
  'boston': ['boston', 'cambridge', 'somerville', 'brookline', 'greater boston'],
  'washington': ['washington', 'd.c.', 'dc', 'arlington', 'alexandria', 'bethesda', 'reston', 'mclean'],
  'los angeles': ['los angeles', 'l.a.', 'santa monica', 'culver city', 'pasadena', 'burbank', 'long beach', 'hollywood'],
  'chicago': ['chicago', 'evanston', 'oak park'],
  'seattle': ['seattle', 'bellevue', 'redmond', 'kirkland'],
}

function aliasesFor(target: string): string[] {
  return METRO_ALIASES[target.trim().toLowerCase()] ?? [target.trim().toLowerCase()]
}
// Anchor the alias to the START of the location string. Locations are formatted
// "City, State, …", so anchoring stops a bare STATE name from matching a CITY
// target: "Ithaca, New York" must NOT match a "New York" (city) search, and
// "Seattle, Washington" must NOT match a "Washington" (DC) search. The trailing
// char must be a boundary so "new york" doesn't match "newark".
function startsWithToken(haystack: string, needle: string): boolean {
  if (!needle || !haystack.startsWith(needle)) return false
  const after = haystack.charAt(needle.length)
  return after === '' || /[^a-z0-9]/i.test(after)
}

export function locationMatch(loc: string | null, targets: string[]): boolean {
  if (!loc || targets.length === 0) return false
  const l = loc.trim().toLowerCase()
  return targets.some((t) => aliasesFor(t).some((a) => startsWithToken(l, a)))
}

export function hasNamedPastEmployer(a: Alumni): boolean {
  return Array.isArray(a.work_history) && a.work_history.some((e) => isRealCompany(e?.company ?? null))
}

/** A real, verifiable hook to personalize on — else drop the candidate (abstain). */
export function hasPersonalizationHook(a: Alumni, studentSport: string | null, targetLocations: string[]): boolean {
  if (isRealCompany(a.company)) return true
  if (studentSport && a.sport && a.sport.toLowerCase() === studentSport.toLowerCase()) return true
  if (locationMatch(a.location, targetLocations)) return true
  if (hasNamedPastEmployer(a)) return true
  return false
}

// ── The goal-relevance signals ──────────────────────────────────────────────
export function industryMatch(a: Alumni, prefs: UserPreferences): boolean {
  return !!a.industry && industryMatchStrength(a.industry, prefs.industries ?? [])
}
export function roleMatch(a: Alumni, prefs: UserPreferences): boolean {
  return (prefs.roles ?? []).some((r) => !!r && !!a.role && a.role.toLowerCase().includes(r.toLowerCase()))
}

/**
 * DETERMINISTIC confidence — the single source of truth for HIGH vs LOW.
 * HIGH requires ALL of:
 *   1. a REAL named current employer (no placeholder),
 *   2. a genuine GOAL overlap — industry match OR role match (this excludes the
 *      similarity-only band ~25-30 and invalid/junk industries that produce no
 *      real overlap), AND
 *   3. a metro-aware LOCATION match when the student specified target cities
 *      (applied uniformly to every candidate — no LLM whim).
 * Everything else is LOW (dropped in production). Location is honored as a HARD
 * gate when specified; relax by passing no target locations.
 */
export function sourcingConfidence(
  a: Alumni,
  prefs: UserPreferences,
  _studentSport: string | null,
  targetLocations: string[],
): 'high' | 'low' {
  const real = isRealCompany(a.company)
  const goal = industryMatch(a, prefs) || roleMatch(a, prefs)
  const cityOk = (targetLocations?.length ?? 0) === 0 || locationMatch(a.location, targetLocations)
  return real && goal && cityOk ? 'high' : 'low'
}
