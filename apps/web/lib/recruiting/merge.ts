// The overlay join: live universe + lazy CRM rows + activity log + matcher
// + activation signals → the ProspectRow the whole feature renders. Derived
// facts are computed on every read and never stored, so they cannot drift.

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  RecruitingActivity,
  RecruitingActivityKind,
  RecruitingActivityOutcome,
  RecruitingProspect,
  RecruitingTeamState,
} from '@scout/shared/types/database'
import { fetchUniverse, type UniversePerson } from './universe'
import { computeMatches, type MatchSuggestion, type MatchTier, type StudentProfileLite } from './match'
import { isMissingTableError } from './errors'

export type EffectiveStage =
  | 'untouched' | 'targeted' | 'reached_out' | 'responded'
  | 'signed_up' | 'activated' | 'not_now'

export interface ProspectRow {
  alumni_id: string
  full_name: string
  sport: string
  team_key: string
  graduation_year: number
  location: string | null
  photo_url: string | null
  linkedin_url: string | null
  crm: RecruitingProspect | null
  effective_stage: EffectiveStage
  agreed: boolean
  last_activity: { kind: RecruitingActivityKind; outcome: RecruitingActivityOutcome | null; occurred_at: string } | null
  days_since_touch: number | null
  stalled: boolean
  match: {
    profile_id: string
    tier: MatchTier
    student_email: string | null
    joined_at: string
    onboarding_completed: boolean
    first_save_at: string | null
    first_message_at: string | null
    activated: boolean
  } | null
}

export interface TeamRollup {
  team_key: string
  roster: number
  untouched: number
  targeted: number
  reached_out: number
  responded: number
  signed_up: number
  activated: number
  not_now: number
  penetration: number
  last_touch_at: string | null
  is_focus: boolean
  strategy_notes: string | null
}

export interface RecruitingBundle {
  rows: ProspectRow[]
  crmReady: boolean
  suggestions: Map<string, MatchSuggestion[]>
  prospectsByAlumniId: Map<string, RecruitingProspect>
  activitiesByProspectId: Map<string, RecruitingActivity[]>
  teamsState: Map<string, RecruitingTeamState>
}

const STALLED_AFTER_DAYS = 7
const DAY_MS = 86_400_000

export async function loadRecruitingBundle(db: SupabaseClient): Promise<RecruitingBundle> {
  const [universe, profilesRes, prospectsRes, activitiesRes, teamsRes, eventsRes] = await Promise.all([
    fetchUniverse(db),
    db
      .from('profiles')
      .select('id, full_name, sport, email, graduation_year, alumni_id, onboarding_completed, created_at')
      .eq('account_role', 'student'),
    db.from('recruiting_prospects').select('*'),
    db.from('recruiting_activities').select('*').order('occurred_at', { ascending: false }),
    db.from('recruiting_teams').select('*'),
    db
      .from('user_events')
      .select('user_id, event_type, created_at')
      .in('event_type', ['alumni_added_to_network', 'message_sent']),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (eventsRes.error) throw eventsRes.error

  // Missing CRM tables (migration 070 not applied yet) → full read-only mode.
  const crmMissing =
    isMissingTableError(prospectsRes.error) ||
    isMissingTableError(activitiesRes.error) ||
    isMissingTableError(teamsRes.error)
  if (prospectsRes.error && !crmMissing) throw prospectsRes.error
  if (activitiesRes.error && !crmMissing) throw activitiesRes.error
  if (teamsRes.error && !crmMissing) throw teamsRes.error

  const prospects = (crmMissing ? [] : (prospectsRes.data ?? [])) as RecruitingProspect[]
  const activities = (crmMissing ? [] : (activitiesRes.data ?? [])) as RecruitingActivity[]
  const teams = (crmMissing ? [] : (teamsRes.data ?? [])) as RecruitingTeamState[]
  const profiles = (profilesRes.data ?? []) as StudentProfileLite[]

  const prospectsByAlumniId = new Map(prospects.map(p => [p.alumni_id, p]))
  const teamsState = new Map(teams.map(t => [t.team_key, t]))

  const activitiesByProspectId = new Map<string, RecruitingActivity[]>()
  for (const a of activities) {
    const list = activitiesByProspectId.get(a.prospect_id)
    if (list) list.push(a)
    else activitiesByProspectId.set(a.prospect_id, [a])
  }

  // Activation signals per signed-up user: first save / first message.
  const firstSaveAt = new Map<string, string>()
  const firstMessageAt = new Map<string, string>()
  for (const e of eventsRes.data ?? []) {
    const target = e.event_type === 'alumni_added_to_network' ? firstSaveAt : firstMessageAt
    const prev = target.get(e.user_id as string)
    if (!prev || (e.created_at as string) < prev) target.set(e.user_id as string, e.created_at as string)
  }

  const { matches, suggestions } = computeMatches(universe, profiles, prospectsByAlumniId)

  const now = Date.now()
  const rows = universe.map(person =>
    buildRow(person, prospectsByAlumniId.get(person.id) ?? null, matches.get(person.id) ?? null, {
      activitiesByProspectId,
      firstSaveAt,
      firstMessageAt,
      now,
    }),
  )

  return { rows, crmReady: !crmMissing, suggestions, prospectsByAlumniId, activitiesByProspectId, teamsState }
}

function buildRow(
  person: UniversePerson,
  crm: RecruitingProspect | null,
  match: { tier: MatchTier; profile: StudentProfileLite } | null,
  ctx: {
    activitiesByProspectId: Map<string, RecruitingActivity[]>
    firstSaveAt: Map<string, string>
    firstMessageAt: Map<string, string>
    now: number
  },
): ProspectRow {
  const acts = crm ? ctx.activitiesByProspectId.get(crm.id) ?? [] : []
  const last = acts[0] ?? null

  let matchInfo: ProspectRow['match'] = null
  if (match) {
    const p = match.profile
    const save = ctx.firstSaveAt.get(p.id) ?? null
    const msg = ctx.firstMessageAt.get(p.id) ?? null
    matchInfo = {
      profile_id: p.id,
      tier: match.tier,
      student_email: p.email,
      joined_at: p.created_at,
      onboarding_completed: Boolean(p.onboarding_completed),
      first_save_at: save,
      first_message_at: msg,
      activated: Boolean(save || msg),
    }
  }

  // Derived stages always win for display; the manual status stays stored.
  const manual = crm?.status ?? 'untouched'
  const effective_stage: EffectiveStage = matchInfo
    ? (matchInfo.activated ? 'activated' : 'signed_up')
    : manual

  const lastTouchIso = last?.occurred_at ?? (manual !== 'untouched' ? crm?.updated_at ?? null : null)
  const days_since_touch = lastTouchIso
    ? Math.floor((ctx.now - new Date(lastTouchIso).getTime()) / DAY_MS)
    : null

  return {
    alumni_id: person.id,
    full_name: person.full_name,
    sport: person.sport,
    team_key: person.team_key,
    graduation_year: person.graduation_year,
    location: person.location,
    photo_url: person.photo_url,
    linkedin_url: person.linkedin_url,
    crm,
    effective_stage,
    agreed: !matchInfo && acts.some(a => a.outcome === 'agreed_to_join'),
    last_activity: last ? { kind: last.kind, outcome: last.outcome, occurred_at: last.occurred_at } : null,
    days_since_touch,
    stalled:
      (effective_stage === 'targeted' || effective_stage === 'reached_out') &&
      days_since_touch !== null &&
      days_since_touch > STALLED_AFTER_DAYS,
    match: matchInfo,
  }
}

// ── Worklist filtering / sorting (shared by the list route and CSV export) ──

export interface WorklistParams {
  search?: string
  team?: string
  year?: string
  stage?: string
  focus?: boolean
}

export function filterRows(rows: ProspectRow[], params: WorklistParams): ProspectRow[] {
  let out = rows
  if (params.search) {
    const q = params.search.toLowerCase()
    out = out.filter(r => r.full_name.toLowerCase().includes(q))
  }
  if (params.team) out = out.filter(r => r.team_key === params.team)
  if (params.year) out = out.filter(r => String(r.graduation_year) === params.year)
  if (params.stage && params.stage !== 'all') out = out.filter(r => r.effective_stage === params.stage)
  if (params.focus) out = out.filter(r => isDue(r) || r.stalled)
  return out
}

export function isDue(r: ProspectRow): boolean {
  if (!r.crm?.next_action_due) return false
  if (r.effective_stage === 'signed_up' || r.effective_stage === 'activated' || r.effective_stage === 'not_now') return false
  return r.crm.next_action_due <= todayIso()
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function sortRows(rows: ProspectRow[], sort: string, teamFiltered: boolean): ProspectRow[] {
  const byName = (a: ProspectRow, b: ProspectRow) => a.full_name.localeCompare(b.full_name)
  const captainFirst = (a: ProspectRow, b: ProspectRow) =>
    teamFiltered ? Number(b.crm?.is_captain ?? false) - Number(a.crm?.is_captain ?? false) : 0

  const sorted = [...rows]
  switch (sort) {
    case 'name':
      sorted.sort((a, b) => captainFirst(a, b) || byName(a, b))
      break
    case 'team':
      sorted.sort((a, b) => a.team_key.localeCompare(b.team_key) || captainFirst(a, b) || byName(a, b))
      break
    case 'recent':
      sorted.sort(
        (a, b) =>
          captainFirst(a, b) ||
          (b.last_activity?.occurred_at ?? '').localeCompare(a.last_activity?.occurred_at ?? '') ||
          byName(a, b),
      )
      break
    default: // 'priority': overdue next-actions, then stalled, then longest-quiet
      sorted.sort(
        (a, b) =>
          captainFirst(a, b) ||
          Number(isDue(b)) - Number(isDue(a)) ||
          Number(b.stalled) - Number(a.stalled) ||
          (b.days_since_touch ?? -1) - (a.days_since_touch ?? -1) ||
          byName(a, b),
      )
  }
  return sorted
}

// ── Summary rollups ──

export function computeSummary(rows: ProspectRow[], teamsState: Map<string, RecruitingTeamState>) {
  const stages: Record<EffectiveStage, number> = {
    untouched: 0, targeted: 0, reached_out: 0, responded: 0, signed_up: 0, activated: 0, not_now: 0,
  }
  let stalled_count = 0
  let due_today_count = 0

  const teamMap = new Map<string, TeamRollup>()
  for (const r of rows) {
    stages[r.effective_stage]++
    if (r.stalled) stalled_count++
    if (isDue(r)) due_today_count++

    let t = teamMap.get(r.team_key)
    if (!t) {
      const state = teamsState.get(r.team_key)
      t = {
        team_key: r.team_key,
        roster: 0,
        untouched: 0, targeted: 0, reached_out: 0, responded: 0, signed_up: 0, activated: 0, not_now: 0,
        penetration: 0,
        last_touch_at: null,
        is_focus: state?.is_focus ?? false,
        strategy_notes: state?.strategy_notes ?? null,
      }
      teamMap.set(r.team_key, t)
    }
    t.roster++
    t[r.effective_stage]++
    const touch = r.last_activity?.occurred_at ?? null
    if (touch && (!t.last_touch_at || touch > t.last_touch_at)) t.last_touch_at = touch
  }

  const teams = [...teamMap.values()]
  for (const t of teams) {
    t.penetration = t.roster ? Math.round(((t.signed_up + t.activated) / t.roster) * 100) : 0
  }
  teams.sort(
    (a, b) =>
      Number(b.is_focus) - Number(a.is_focus) ||
      a.penetration - b.penetration ||
      b.roster - a.roster,
  )

  return { stages, stalled_count, due_today_count, teams }
}
