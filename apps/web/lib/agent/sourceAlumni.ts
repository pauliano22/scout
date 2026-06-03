// Agent-side sourcing — finds candidate alumni for a campaign's slice, reusing
// the SAME primitives as the (intact) live search route: embedText → the
// match_alumni_semantic RPC → the shared scorer floor → rerank. Server-callable
// with a service-role client and an explicit exclude list.
//
// Two hard gates run BEFORE anything is returned (the contrarian guardrails):
//   1. A conservative quality + SPECIFICITY gate — only return an alum if there
//      is a real personalization hook (role+company, shared sport, work history).
//      On the sparse corpus this means we ABSTAIN (return []) rather than pad a
//      campaign with mis-tagged near-empty profiles.
//   2. The caller (cron) passes ledger-capped + already-networked ids in
//      `excludeIds`, so over-fished alumni never enter any student's set.

import { embedText } from '@/lib/search/embeddings'
import { rerankCandidates } from '@/lib/search/rerank'
import { scoreAlumnus, type UserPreferences } from '@scout/shared/scoring/recommendationScoring'
import type { Alumni } from '@scout/shared/types/database'

type DbClient = { rpc: (fn: string, args: any) => any }

const VECTOR_TOP_K = 30
const SCORE_FLOOR = 25
const SIM_FLOOR = 0.3
const RERANK_POOL = 12

export interface SourcedAlum {
  alumnus: Alumni
  why: string // rerank reasoning — stored as the proposed row's "why"
}

/** A real, verifiable hook to personalize on — or we abstain (don't pad). */
function hasPersonalizationHook(a: Alumni, studentSport: string | null): boolean {
  if (a.role && a.company) return true
  if (studentSport && a.sport && a.sport.toLowerCase() === studentSport.toLowerCase()) return true
  if (Array.isArray(a.work_history) && a.work_history.length > 0) return true
  return false
}

export async function sourceAlumni(
  supabase: DbClient,
  opts: {
    searchPhrase: string
    themes?: string[]
    prefs: UserPreferences
    excludeIds: string[]
    studentSport: string | null
    limit?: number
  },
): Promise<SourcedAlum[]> {
  let vec: number[]
  try {
    vec = await embedText(opts.searchPhrase)
  } catch {
    return [] // embedding unavailable — abstain this tick
  }

  const { data, error } = await supabase.rpc('match_alumni_semantic', {
    query_embedding: vec,
    exclude_ids: opts.excludeIds,
    location_q: null,
    grad_year_min: null,
    grad_year_max: null,
    match_count: VECTOR_TOP_K,
  })
  if (error || !data) return []

  const rows = data as (Alumni & { similarity?: number })[]
  const gated = rows
    .map((r) => ({ row: r, sim: r.similarity ?? 0, score: scoreAlumnus(r as unknown as Alumni, opts.prefs, {}).score }))
    .filter((c) => (c.score >= SCORE_FLOOR || c.sim >= SIM_FLOOR) && hasPersonalizationHook(c.row, opts.studentSport))
    .sort((a, b) => b.score - a.score || b.sim - a.sim)
    .slice(0, RERANK_POOL)

  if (gated.length === 0) return [] // ABSTAIN — no strong, personalizable matches this week

  const rr = await rerankCandidates({
    userQuery: opts.searchPhrase,
    searchPhrase: opts.searchPhrase,
    themes: opts.themes ?? [],
    candidates: gated.map((c) => ({
      id: c.row.id,
      full_name: c.row.full_name,
      sport: c.row.sport,
      graduation_year: c.row.graduation_year,
      company: c.row.company,
      role: c.row.role,
      industry: c.row.industry,
      location: c.row.location,
      bio: c.row.bio,
      display_headline: c.row.display_headline,
      preScore: c.score,
    })),
  })

  const byId = new Map(gated.map((c) => [c.row.id, c.row]))
  return rr.matches
    .slice(0, opts.limit ?? 5)
    .map((m) => ({ alumnus: byId.get(m.alumnus_id) as Alumni, why: m.reasoning }))
    .filter((x) => x.alumnus)
}
