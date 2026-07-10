// Shared campaign-goal creation used by the explicit goal step
// (/api/campaign/goal) and the onboarding autostart (/api/campaign/autostart).
// Writing through one function keeps the two entry points from drifting.

import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidIndustry, type CorpusIndustry } from './industries'

export const GOAL_METRICS = ['informational_interview', 'referral', 'mentor_relationship'] as const
export type GoalMetric = (typeof GOAL_METRICS)[number]

export interface CampaignGoal {
  goalMetric: GoalMetric
  goalCount: number
  deadline: string // YYYY-MM-DD
  industry: CorpusIndustry
  focus: string | null
  city: string | null
}

export const DEFAULT_GOAL_COUNT = 3
export const DEFAULT_DEADLINE_DAYS = 70

export function defaultDeadline(from = new Date()): string {
  const d = new Date(from.getTime() + DEFAULT_DEADLINE_DAYS * 86_400_000)
  return d.toISOString().slice(0, 10)
}

/**
 * Upserts the student's active networking_plan with the campaign goal and
 * writes the validated targeting slice to their profile (the sourcing loop
 * reads the profile). Returns the plan id.
 */
export async function applyCampaignGoal(
  supabase: SupabaseClient,
  userId: string,
  goal: CampaignGoal
): Promise<{ planId: string }> {
  const fields = {
    goal_metric: goal.goalMetric,
    goal_count: goal.goalCount,
    deadline: goal.deadline,
    campaign_status: 'active',
    sourcing_enabled: true,
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: readErr } = await supabase
    .from('networking_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  // A failed read must not fall through to the insert branch — that mints a
  // second active plan (duplicate-mutex corruption; audit 2026-07-10).
  if (readErr) throw new Error(`plan read failed: ${readErr.message}`)

  let planId: string
  if (existing) {
    const { error } = await supabase
      .from('networking_plans')
      .update(fields)
      .eq('id', existing.id)
      .eq('user_id', userId)
    if (error) throw new Error(`plan update failed: ${error.message}`)
    planId = existing.id
  } else {
    const { data: created, error } = await supabase
      .from('networking_plans')
      .insert({ user_id: userId, title: `${goal.industry} campaign`, is_active: true, ...fields })
      .select('id')
      .single()
    if (error || !created) throw new Error(`plan insert failed: ${error?.message}`)
    planId = created.id
  }

  const profileUpdate: Record<string, unknown> = { primary_industry: goal.industry, interests: goal.focus }
  if (goal.city) profileUpdate.preferred_locations = [goal.city]
  const { error: profErr } = await supabase.from('profiles').update(profileUpdate).eq('id', userId)
  if (profErr) console.warn('[campaign/goal] profile slice update failed:', profErr.message)

  return { planId }
}

// ── Internal goal derivation ─────────────────────────────────────────────────
// The agent owns campaign state; students never see a form. Defaults: informational
// conversations, internal pacing (picks accrue 1/day between logins, see dailyPicks).
const METRIC_BY_STAGE: Record<string, GoalMetric> = {
  exploring: 'informational_interview',
  recruiting: 'referral',
  interviewing: 'referral',
  referrals: 'referral',
  relationship_building: 'mentor_relationship',
}

export interface ProfileSlice {
  primary_industry?: string | null
  secondary_industries?: string[] | null
  current_stage?: string | null
  preferred_locations?: string[] | null
  geography_preference?: string | null
}

export function deriveGoalFromProfile(profile: ProfileSlice): CampaignGoal | null {
  const candidates = [profile.primary_industry, ...(profile.secondary_industries ?? [])]
  const industry = candidates.find(isValidIndustry) ?? null
  if (!industry) return null
  const locations = (Array.isArray(profile.preferred_locations) ? profile.preferred_locations : [])
    .flatMap((l) => String(l).split(',')).map((l) => l.trim()).filter(Boolean)
  const city = profile.geography_preference !== 'doesnt_matter' && locations[0]
    ? locations[0].slice(0, 60)
    : null
  return {
    goalMetric: METRIC_BY_STAGE[profile.current_stage ?? ''] ?? 'informational_interview',
    goalCount: DEFAULT_GOAL_COUNT,
    deadline: defaultDeadline(),
    industry,
    focus: null,
    city,
  }
}

/**
 * Idempotent: agent state exists after this call. With a usable field the plan
 * gets the full derived goal; without one a bare active plan is created anyway —
 * it carries the picks accrual clock (last_sourced_at) and pause flag, and the
 * goal fills in the moment a field arrives.
 */
export async function ensureAgentState(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: existing, error: existErr } = await supabase
    .from('networking_plans')
    .select('id, deadline')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  // On a failed read, bail without creating anything — a second active plan
  // is a fresh mint-mutex (audit 2026-07-10).
  if (existErr) {
    console.error('[agentState] plan read failed:', existErr.message)
    return null
  }
  if (existing?.deadline) return existing.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('primary_industry, secondary_industries, current_stage, preferred_locations, geography_preference')
    .eq('id', userId)
    .single()
  if (!profile) return existing?.id ?? null

  const goal = deriveGoalFromProfile(profile)
  if (goal) {
    const { planId } = await applyCampaignGoal(supabase, userId, goal)
    return planId
  }

  if (existing) return existing.id
  const { data: created, error: createErr } = await supabase
    .from('networking_plans')
    .insert({ user_id: userId, title: 'Scout picks', is_active: true, campaign_status: 'active', sourcing_enabled: true })
    .select('id')
    .single()
  if (createErr) console.error('[agentState] plan insert failed:', createErr.message)
  return created?.id ?? null
}
