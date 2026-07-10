// Agent-side sourcing — finds candidate alumni for a campaign's slice, reusing
// the SAME primitives as the live search route: embedText → the
// match_alumni_semantic RPC → the shared scorer floor → a MATCH-ARGUMENT
// reasoner (reasonSourcing). Server-callable with a service-role client.
//
// Gates run BEFORE anything is returned (the contrarian guardrails):
//   1. Quality + SPECIFICITY: keep an alum only with a REAL personalization
//      hook — a real NAMED current company, a shared sport, an overlap with the
//      student's target cities, or a NAMED past employer. Placeholder companies
//      ("Stealth Startup", "Self-employed", …) do NOT count. Else we abstain.
//   2. CONFIDENCE: reasonSourcing rates each match high/low against the student's
//      ACTUAL profile + work history. By default we return only HIGH-confidence
//      matches — fewer genuinely-matched alumni beat three padded cards. Low ones
//      are dropped unless includeLowConfidence is set (the diagnostic harness).
//   3. The caller passes ledger-capped + already-networked ids in excludeIds.

import { embedText } from '@/lib/search/embeddings'
import { reasonSourcing, type SourcingStudent } from '@/lib/agent/reasonSourcing'
import { scoreAlumnus, type UserPreferences } from '@scout/shared/scoring/recommendationScoring'
import type { Alumni } from '@scout/shared/types/database'
import { hasPersonalizationHook, sourcingConfidence, locationMatch } from '@/lib/agent/sourceAlumniGate'
import { hasHardViolation } from '@/lib/agent/reasonLint'

type DbClient = { rpc: (fn: string, args: any) => any }

const VECTOR_TOP_K = 30
const SCORE_FLOOR = 25
const SIM_FLOOR = 0.3
const REASON_POOL = 12

export interface SourcedAlum {
  alumnus: Alumni
  why: string // the match-argument reasoning — stored as the proposed row's "why"
  sim: number // vector similarity it cleared with
  score: number // shared-scorer fit score it cleared with
  confidence: 'high' | 'low'
}

export async function sourceAlumni(
  supabase: DbClient,
  opts: {
    searchPhrase: string
    prefs: UserPreferences
    excludeIds: string[]
    studentSport: string | null
    studentName?: string
    goalMetric?: string
    graduationYear?: number | null
    limit?: number
    /** Diagnostics: return low-confidence matches too (default false — high only). */
    includeLowConfidence?: boolean
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
  if (error) console.error('[sourceAlumni] match_alumni_semantic rpc failed:', error.message)
  if (error || !data) return []

  const targetLocations = opts.prefs.locations ?? []
  const rows = data as (Alumni & { similarity?: number })[]
  const gated = rows
    .map((r) => ({ row: r as Alumni, sim: r.similarity ?? 0, score: scoreAlumnus(r as unknown as Alumni, opts.prefs, {}).score }))
    .filter((c) => (c.score >= SCORE_FLOOR || c.sim >= SIM_FLOOR) && hasPersonalizationHook(c.row, opts.studentSport, targetLocations))
    .sort((a, b) => b.score - a.score || b.sim - a.sim)
    .slice(0, REASON_POOL)

  if (gated.length === 0) return [] // ABSTAIN — no strong, personalizable matches

  // 1) DETERMINISTIC confidence first (the LLM never DECIDES high/low).
  const scored = gated.map((g) => ({
    row: g.row, sim: g.sim, score: g.score,
    dconf: sourcingConfidence(g.row, opts.prefs, opts.studentSport, targetLocations) as 'high' | 'low',
  }))

  const byCity = (loc: string | null) => (locationMatch(loc, targetLocations) ? 1 : 0)
  // 2) Pool to reason over — HIGH only in production, everything in the diagnostic.
  const pool = (opts.includeLowConfidence ? scored : scored.filter((s) => s.dconf === 'high'))
    .sort((a, b) =>
      (a.dconf === 'high' ? 0 : 1) - (b.dconf === 'high' ? 0 : 1) ||
      byCity(b.row.location) - byCity(a.row.location) ||
      b.score - a.score,
    )
  if (pool.length === 0) return [] // ABSTAIN — nothing cleared the HIGH gate

  // 3) Write a real match argument for each, AND get the soft role-relevance read.
  const student: SourcingStudent = {
    name: opts.studentName ?? 'the student',
    sport: opts.studentSport,
    graduation_year: opts.graduationYear ?? null,
    industries: opts.prefs.industries ?? [],
    roles: opts.prefs.roles ?? [],
    locations: targetLocations,
    goalMetric: opts.goalMetric ?? 'informational_interview',
  }
  const rr = await reasonSourcing(
    student,
    pool.map((s) => ({
      id: s.row.id, full_name: s.row.full_name, sport: s.row.sport, graduation_year: s.row.graduation_year,
      role: s.row.role, company: s.row.company, industry: s.row.industry, location: s.row.location, work_history: s.row.work_history,
    })),
  )
  const byId = new Map(rr.matches.map((m) => [m.alumnus_id, m]))
  const fallback = (a: Alumni) =>
    `${a.role ? a.role + (a.company ? ` at ${a.company}` : '') : a.company ?? 'Alum'}${a.industry ? ` · ${a.industry}` : ''}${a.location ? ` · ${a.location}` : ''}`

  // 4) Soft role-relevance DOWNGRADE: the LLM may drop a deterministic-HIGH to
  //    LOW when the role is clearly off-target (e.g. a facilities role for a SWE
  //    goal) — but it can NEVER upgrade, and it never touches seniority.
  const reasoned: SourcedAlum[] = pool
    .map((s) => {
      const m = byId.get(s.row.id)
      const roleOk = m ? m.roleRelevant : true
      const confidence: 'high' | 'low' = s.dconf === 'high' && roleOk ? 'high' : 'low'
      // Integrity backstop: if the LLM reason manufactured an athlete bond (no
      // real sport match) or cited a non-literal title, replace it with a clean
      // fact-based line. Deterministic — never ships a fabricated connection.
      const sportMatched = !!opts.studentSport && !!s.row.sport && s.row.sport.toLowerCase() === opts.studentSport.toLowerCase()
      let why = m?.reasoning ?? fallback(s.row)
      if (m?.reasoning && hasHardViolation(m.reasoning, { sportMatched })) why = fallback(s.row)
      return { alumnus: s.row, why, sim: s.sim, score: s.score, confidence }
    })
    .sort((a, b) =>
      (a.confidence === 'high' ? 0 : 1) - (b.confidence === 'high' ? 0 : 1) ||
      byCity(b.alumnus.location) - byCity(a.alumnus.location) ||
      b.score - a.score,
    )

  const out = opts.includeLowConfidence ? reasoned : reasoned.filter((r) => r.confidence === 'high')
  return out.slice(0, opts.limit ?? 5)
}
