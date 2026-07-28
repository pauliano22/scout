// The prospect universe: every CURRENT Cornell student-athlete in the
// alumni table, composed live on each request — never copied into CRM
// tables, so the roster can't drift.
//
// Explicit column list on purpose: email and embedding are never selected
// (scraped contact data is not an outreach path — compliance pack 07-LEGAL).

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeSport, cleanSportName } from '@/lib/sports/normalize'

export interface UniversePerson {
  id: string
  full_name: string
  sport: string
  graduation_year: number
  location: string | null
  photo_url: string | null
  linkedin_url: string | null
  /** Server-side only (match adoption) — never returned to the client. */
  claimed_by_user_id: string | null
  /** Canonical team key derived from the free-text sport column. */
  team_key: string
}

const UNIVERSE_COLUMNS = 'id, full_name, sport, graduation_year, location, photo_url, linkedin_url, claimed_by_user_id'

/**
 * A student is "current" while their graduation year is still ahead of the
 * academic calendar: after June, the just-graduated class rolls off.
 * Never hardcode a year — this stays correct every fall.
 */
export function currentStudentCutoff(now = new Date()): number {
  return now.getFullYear() + (now.getMonth() >= 5 ? 1 : 0)
}

/** Canonical team key for grouping ("Mens Rowing" and "Rowing" fold together). */
export function teamKeyFor(rawSport: string | null): string {
  if (!rawSport?.trim()) return 'Unknown'
  const result = normalizeSport(rawSport)
  if (result.confidence > 0) return result.canonicalName
  return cleanSportName(rawSport) || rawSport.trim()
}

/**
 * Fetch the live universe. Excludes duplicates, directory opt-outs
 * (is_public=false — an opt-out signal the CRM respects wholesale), and
 * anyone who ever filed a removal request.
 */
export async function fetchUniverse(db: SupabaseClient): Promise<UniversePerson[]> {
  const cutoff = currentStudentCutoff()

  const [{ data: rows, error }, { data: removals }] = await Promise.all([
    db
      .from('alumni')
      .select(UNIVERSE_COLUMNS)
      .gte('graduation_year', cutoff)
      .not('is_duplicate', 'is', true)
      .not('is_public', 'is', false)
      .order('full_name'),
    db.from('alumni_removal_requests').select('alumni_id'),
  ])
  if (error) throw error

  const removed = new Set((removals ?? []).map(r => r.alumni_id as string).filter(Boolean))

  return (rows ?? [])
    .filter(r => !removed.has(r.id as string) && (r.full_name as string)?.trim())
    .map(r => ({
      id: r.id as string,
      full_name: r.full_name as string,
      sport: (r.sport as string) ?? '',
      graduation_year: r.graduation_year as number,
      location: (r.location as string) ?? null,
      photo_url: (r.photo_url as string) ?? null,
      linkedin_url: (r.linkedin_url as string) ?? null,
      claimed_by_user_id: (r.claimed_by_user_id as string) ?? null,
      team_key: teamKeyFor(r.sport as string | null),
    }))
}
