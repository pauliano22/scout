// ─────────────────────────────────────────────────────────────────────────────
// Scout Networking Agent — Scoring Engine
//
// Ranks alumni by how well they match the user's career goal and preferences.
// Scores are additive and transparent — each factor is tracked separately
// so the UI can explain why each person was recommended.
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentAlumni, AgentInput, RankedAlumni } from './types'

const WEIGHTS = {
  industryMatch:    30,   // per keyword match against preferences.industries
  sportMatch:       20,   // alumni played same sport as the user's preference
  locationMatch:    15,   // alumni location contains one of the preferred cities
  hasRole:           5,   // profile has a job title
  hasCompany:        5,   // profile has a company
  hasLinkedIn:       5,   // LinkedIn URL present (easier to reach)
  seniorityBonus:   10,   // graduated 4+ years ago — more established career
}

/** True if the alumni's industry/role/company overlap with any preference keyword. */
function industryScore(alumni: AgentAlumni, keywords: string[]): number {
  const haystack = [alumni.industry, alumni.role, alumni.company]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let score = 0
  for (const kw of keywords) {
    if (haystack.includes(kw.toLowerCase())) score += WEIGHTS.industryMatch
  }
  // Cap at 2x to avoid inflating on extremely keyword-heavy profiles
  return Math.min(score, WEIGHTS.industryMatch * 2)
}

/** True if the alumni's sport loosely matches the preferred sport. */
function sportScore(alumni: AgentAlumni, preferredSport?: string): number {
  if (!preferredSport) return 0
  const alumniSport = alumni.sport.toLowerCase()
  const pref = preferredSport.toLowerCase()
  // Handle "Football" matching "Sprint Football", "Women's Football", etc.
  if (alumniSport.includes(pref) || pref.includes(alumniSport)) {
    return WEIGHTS.sportMatch
  }
  return 0
}

/** Score based on how closely the alumni's location matches preferred cities. */
function locationScore(alumni: AgentAlumni, locations: string[]): number {
  if (!alumni.location) return 0
  const loc = alumni.location.toLowerCase()
  for (const city of locations) {
    if (loc.includes(city.toLowerCase())) return WEIGHTS.locationMatch
  }
  return 0
}

/** Build a single human-readable sentence explaining why this person was picked. */
function buildReason(alumni: RankedAlumni, input: AgentInput): string {
  const parts: string[] = []

  if (alumni.scoreBreakdown.sportMatch > 0) {
    parts.push(`fellow Cornell ${input.preferences.sport ?? alumni.sport} player`)
  }

  if (alumni.role && alumni.company) {
    parts.push(`${alumni.role} at ${alumni.company}`)
  } else if (alumni.company) {
    parts.push(`works at ${alumni.company}`)
  }

  const industryKw = input.preferences.industries.find(kw =>
    [alumni.industry, alumni.role, alumni.company]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(kw.toLowerCase())
  )
  if (industryKw) parts.push(`strong ${industryKw} connection`)

  if (alumni.scoreBreakdown.locationMatch > 0 && alumni.location) {
    parts.push(`based in ${alumni.location.split(',')[0]}`)
  }

  if (parts.length === 0) return 'Cornell athlete with relevant career experience.'

  // Capitalize first word and join naturally
  const joined = parts.join(' · ')
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.'
}

/**
 * Score all alumni against the input and return them sorted best-first.
 * Only returns alumni with a score > 0.
 */
export function rankAlumni(
  alumni: AgentAlumni[],
  input: AgentInput,
): RankedAlumni[] {
  const scored: RankedAlumni[] = alumni.map(a => {
    const industryPts  = industryScore(a, input.preferences.industries)
    const sportPts     = sportScore(a, input.preferences.sport)
    const locationPts  = locationScore(a, input.preferences.locations)
    const qualityPts   =
      (a.role        ? WEIGHTS.hasRole     : 0) +
      (a.company     ? WEIGHTS.hasCompany  : 0) +
      (a.linkedin_url ? WEIGHTS.hasLinkedIn : 0) +
      (new Date().getFullYear() - a.graduation_year >= 4 ? WEIGHTS.seniorityBonus : 0)

    const total = industryPts + sportPts + locationPts + qualityPts

    const ranked: RankedAlumni = {
      ...a,
      score: total,
      reason: '',                   // filled in below after full object exists
      scoreBreakdown: {
        industryMatch: industryPts,
        sportMatch:    sportPts,
        locationMatch: locationPts,
        profileQuality: qualityPts,
      },
    }
    ranked.reason = buildReason(ranked, input)
    return ranked
  })

  return scored
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score)
}
