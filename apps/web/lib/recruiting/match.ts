// Prospect ↔ signed-up-profile matching, computed fresh on every read.
//
// Tiers, strictest first:
//   confirmed — a human said so (stored matched_profile_id), or the product
//               already links them (profiles.alumni_id / alumni.claimed_by_user_id).
//   auto      — unique-both-ways normalized name + team match. Counted as
//               signed up, badged "auto", one-click confirm/reject in the UI.
//   suggested — name-only match or ANY ambiguity (duplicate roster names,
//               dual-rostered athletes). Never auto-counted; surfaced in the
//               drawer for a human decision.
//
// Grad year is shown in the UI as a confidence check but is never a join key:
// real roster-vs-signup year disagreements exist in prod.

import type { RecruitingProspect } from '@scout/shared/types/database'
import { teamKeyFor, type UniversePerson } from './universe'

export interface StudentProfileLite {
  id: string
  full_name: string
  sport: string | null
  email: string | null
  graduation_year: number | null
  alumni_id: string | null
  onboarding_completed: boolean | null
  created_at: string
}

export type MatchTier = 'confirmed' | 'auto' | 'suggested'

export interface ProspectMatch {
  tier: MatchTier
  profile: StudentProfileLite
}

export interface MatchSuggestion {
  profile: StudentProfileLite
  reason: string
}

/** lower/trim/collapse whitespace, strip diacritics, reorder "Last, First". */
export function normalizeName(raw: string): string {
  let name = raw.trim()
  const comma = name.indexOf(',')
  if (comma > 0 && comma < name.length - 1) {
    name = `${name.slice(comma + 1).trim()} ${name.slice(0, comma).trim()}`
  }
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface MatchOutput {
  /** alumni_id → best match (confirmed/auto) or null when none/ambiguous. */
  matches: Map<string, ProspectMatch | null>
  /** alumni_id → suggestion candidates (for the drawer), rejected excluded. */
  suggestions: Map<string, MatchSuggestion[]>
}

export function computeMatches(
  universe: UniversePerson[],
  profiles: StudentProfileLite[],
  prospectsByAlumniId: Map<string, RecruitingProspect>,
): MatchOutput {
  const matches = new Map<string, ProspectMatch | null>()
  const suggestions = new Map<string, MatchSuggestion[]>()
  const profileById = new Map(profiles.map(p => [p.id, p]))
  const usedProfileIds = new Set<string>()

  // ── Tier 1: confirmed (stored link or product-level link) ──
  const profileByAlumniLink = new Map<string, StudentProfileLite>()
  for (const p of profiles) if (p.alumni_id) profileByAlumniLink.set(p.alumni_id, p)

  for (const person of universe) {
    const stored = prospectsByAlumniId.get(person.id)?.matched_profile_id
    const profile =
      (stored ? profileById.get(stored) : undefined) ??
      profileByAlumniLink.get(person.id) ??
      (person.claimed_by_user_id ? profileById.get(person.claimed_by_user_id) : undefined)
    if (profile) {
      matches.set(person.id, { tier: 'confirmed', profile })
      usedProfileIds.add(profile.id)
    }
  }

  // ── Index the leftovers by normalized name (+ team) ──
  const freePeople = universe.filter(p => !matches.has(p.id))
  const freeProfiles = profiles.filter(p => !usedProfileIds.has(p.id))

  const peopleByName = groupBy(freePeople, p => normalizeName(p.full_name))
  const profilesByName = groupBy(freeProfiles, p => normalizeName(p.full_name))
  const peopleByNameTeam = groupBy(freePeople, p => `${normalizeName(p.full_name)}|${p.team_key}`)
  const profilesByNameTeam = groupBy(freeProfiles, p => `${normalizeName(p.full_name)}|${teamKeyFor(p.sport)}`)

  for (const person of freePeople) {
    const rejected = new Set(prospectsByAlumniId.get(person.id)?.rejected_profile_ids ?? [])
    const name = normalizeName(person.full_name)
    const nameTeamKey = `${name}|${person.team_key}`

    const exact = (profilesByNameTeam.get(nameTeamKey) ?? []).filter(p => !rejected.has(p.id))
    const nameOnly = (profilesByName.get(name) ?? []).filter(p => !rejected.has(p.id))

    // ── Tier 2: auto — unique in BOTH directions on name + team ──
    const personUnique = (peopleByNameTeam.get(nameTeamKey) ?? []).length === 1
    if (exact.length === 1 && personUnique && (peopleByName.get(name) ?? []).length === 1 && nameOnly.length === 1) {
      matches.set(person.id, { tier: 'auto', profile: exact[0] })
      continue
    }

    // ── Tier 3: suggested — anything plausible but not provable ──
    matches.set(person.id, null)
    const cands: MatchSuggestion[] = []
    for (const p of exact) {
      cands.push({ profile: p, reason: `Same name and team${yearNote(person, p)}` })
    }
    for (const p of nameOnly) {
      if (exact.includes(p)) continue
      cands.push({
        profile: p,
        reason: `Same name, signed up under “${p.sport?.trim() || 'no sport'}”${yearNote(person, p)}`,
      })
    }
    if (cands.length) suggestions.set(person.id, cands.slice(0, 3))
  }

  return { matches, suggestions }
}

function yearNote(person: UniversePerson, p: StudentProfileLite): string {
  if (!p.graduation_year) return ''
  return p.graduation_year === person.graduation_year
    ? ` — class year matches ('${String(person.graduation_year).slice(2)})`
    : ` — class year differs (roster '${String(person.graduation_year).slice(2)}, signup '${String(p.graduation_year).slice(2)})`
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}
