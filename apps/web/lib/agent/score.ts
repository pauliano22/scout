// ─────────────────────────────────────────────────────────────────────────────
// Scout Networking Agent — Scoring Engine
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentAlumni, AgentInput, AlumniTag, RankedAlumni } from './types'

const W = {
  industryFieldMatch: 40,   // alumni.industry DB field exactly matches a keyword
  roleTextMatch:      15,   // keyword found in alumni.role text
  companyTextMatch:    5,   // keyword found in alumni.company text
  sportMatch:         20,
  locationMatch:      15,
  hasRole:             5,
  hasCompany:          5,
  hasLinkedIn:         5,
  seniority:          10,   // graduated 4+ years ago
}

// Industries considered "finance" — used to exclude irrelevant results
const FINANCE_INDUSTRIES = [
  'finance', 'banking', 'investment', 'wealth management',
  'private equity', 'hedge fund', 'asset management',
  'financial services', 'capital markets',
]

// Keywords that are too generic and fire false positives in role/company text
const ROLE_TEXT_BLOCKLIST = ['strategy', 'management', 'solutions', 'services', 'group']

function isFinanceAlumni(alumni: AgentAlumni): boolean {
  if (!alumni.industry) return false
  const ind = alumni.industry.toLowerCase()
  return FINANCE_INDUSTRIES.some(f => ind.includes(f))
}

function isFinanceGoal(keywords: string[]): boolean {
  return keywords.some(kw =>
    FINANCE_INDUSTRIES.some(f => f.includes(kw.toLowerCase()) || kw.toLowerCase().includes(f))
  )
}

function industryPts(alumni: AgentAlumni, keywords: string[]): number {
  let pts = 0

  // Tier 1: exact match against the industry DB field (high confidence)
  if (alumni.industry) {
    const ind = alumni.industry.toLowerCase()
    for (const kw of keywords) {
      if (ind.includes(kw.toLowerCase())) {
        pts += W.industryFieldMatch
        break // one industry-field match is enough, no stacking
      }
    }
  }

  // Tier 2: keyword found in role text (medium confidence)
  // Skip keywords that are too generic and fire false positives
  if (alumni.role) {
    const role = alumni.role.toLowerCase()
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase()
      if (ROLE_TEXT_BLOCKLIST.includes(kwLower)) continue
      if (role.includes(kwLower)) {
        pts += W.roleTextMatch
        break
      }
    }
  }

  // Tier 3: keyword found in company name (low confidence, only non-generic terms)
  if (alumni.company) {
    const co = alumni.company.toLowerCase()
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase()
      if (ROLE_TEXT_BLOCKLIST.includes(kwLower)) continue
      if (co.includes(kwLower)) {
        pts += W.companyTextMatch
        break
      }
    }
  }

  return pts
}

function sportPts(alumni: AgentAlumni, preferred?: string): number {
  if (!preferred) return 0
  const a = alumni.sport.toLowerCase()
  const p = preferred.toLowerCase()
  return (a.includes(p) || p.includes(a)) ? W.sportMatch : 0
}

function locationPts(alumni: AgentAlumni, locations: string[]): number {
  if (!alumni.location) return 0
  const loc = alumni.location.toLowerCase()
  return locations.some(l => loc.includes(l.toLowerCase())) ? W.locationMatch : 0
}

function buildTags(
  alumni: AgentAlumni,
  input: AgentInput,
  breakdown: { industryMatch: number; sportMatch: number; locationMatch: number },
): AlumniTag[] {
  const tags: AlumniTag[] = []

  if (breakdown.sportMatch > 0) {
    tags.push({ type: 'sport', label: `${input.preferences.sport ?? alumni.sport}` })
  }

  const matchedKw = input.preferences.industries.find(kw =>
    alumni.industry?.toLowerCase().includes(kw.toLowerCase()) ||
    (!ROLE_TEXT_BLOCKLIST.includes(kw.toLowerCase()) &&
      [alumni.role, alumni.company]
        .filter(Boolean).join(' ').toLowerCase()
        .includes(kw.toLowerCase()))
  )
  if (matchedKw) tags.push({ type: 'industry', label: matchedKw })

  if (breakdown.locationMatch > 0 && alumni.location) {
    const city = alumni.location.split(',')[0]
    tags.push({ type: 'location', label: city })
  }

  return tags
}

function buildReason(alumni: AgentAlumni, input: AgentInput, tags: AlumniTag[]): string {
  const parts: string[] = []

  const sport = tags.find(t => t.type === 'sport')
  if (sport) parts.push(`Cornell ${sport.label}`)

  if (alumni.role && alumni.company) {
    parts.push(`${alumni.role} at ${alumni.company}`)
  } else if (alumni.company) {
    parts.push(alumni.company)
  }

  const ind = tags.find(t => t.type === 'industry')
  if (ind && !parts.some(p => p.toLowerCase().includes(ind.label.toLowerCase()))) {
    parts.push(`${ind.label} focus`)
  }

  return parts.length ? parts.join(' · ') + '.' : 'Cornell athlete, relevant career path.'
}

export function rankAlumni(alumni: AgentAlumni[], input: AgentInput): RankedAlumni[] {
  const goalIsFinance = isFinanceGoal(input.preferences.industries)

  return alumni
    .map(a => {
      // Exclude finance alumni when the goal is not finance
      if (!goalIsFinance && isFinanceAlumni(a)) {
        return { ...a, score: 0, tags: [], reason: '' }
      }

      const iMatch = industryPts(a, input.preferences.industries)
      const sMatch = sportPts(a, input.preferences.sport)
      const lMatch = locationPts(a, input.preferences.locations)
      const quality =
        (a.role         ? W.hasRole     : 0) +
        (a.company      ? W.hasCompany  : 0) +
        (a.linkedin_url ? W.hasLinkedIn : 0) +
        (new Date().getFullYear() - a.graduation_year >= 4 ? W.seniority : 0)

      const score = iMatch + sMatch + lMatch + quality
      const breakdown = { industryMatch: iMatch, sportMatch: sMatch, locationMatch: lMatch }
      const tags = buildTags(a, input, breakdown)

      return { ...a, score, tags, reason: buildReason(a, input, tags) }
    })
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score)
}
