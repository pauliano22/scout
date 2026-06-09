// POST /api/campaign/goal — the student's self-serve goal step. Writes the
// campaign columns onto their active networking_plan (creating one if none
// exists) and activates the loop (campaign_status='active', sourcing_enabled=true).
//
// It also writes the VALIDATED slice (industry + optional focus phrase + city)
// to the profile, because the campaign goal IS the student's current targeting
// and the sourcing loop reads the profile (profileToPrefs). The industry is
// constrained to the corpus taxonomy, so "fintech" → industry=Finance + focus
// phrase, never a junk slice that silently abstains. The autonomous cron still
// only processes AGENT_PILOT_USER_IDS — this just configures the goal.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CORPUS_INDUSTRIES, isValidIndustry } from '@/lib/campaign/industries'

export const dynamic = 'force-dynamic'

const GOAL_METRICS = ['informational_interview', 'referral', 'mentor_relationship']

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const goalMetric = typeof body.goalMetric === 'string' && GOAL_METRICS.includes(body.goalMetric)
    ? body.goalMetric : 'informational_interview'
  const goalCount = Number.isFinite(Number(body.goalCount))
    ? Math.max(1, Math.min(50, Math.round(Number(body.goalCount)))) : 3
  const deadline = typeof body.deadline === 'string' && body.deadline.trim() ? body.deadline : null
  if (!deadline) return NextResponse.json({ error: 'Missing deadline' }, { status: 400 })

  const industry = typeof body.industry === 'string' && isValidIndustry(body.industry) ? body.industry : null
  if (!industry) return NextResponse.json({ error: 'Missing or invalid industry', valid: CORPUS_INDUSTRIES }, { status: 400 })
  const focus = typeof body.focus === 'string' && body.focus.trim() ? body.focus.trim().slice(0, 80) : null
  const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim().slice(0, 60) : null

  const fields = {
    goal_metric: goalMetric,
    goal_count: goalCount,
    deadline,
    campaign_status: 'active',
    sourcing_enabled: true,
    updated_at: new Date().toISOString(),
  }

  // Upsert the active plan.
  const { data: existing } = await supabase
    .from('networking_plans')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  let planId: string
  if (existing) {
    const { error } = await supabase.from('networking_plans').update(fields).eq('id', existing.id).eq('user_id', user.id)
    if (error) { console.error('[campaign/goal] update error:', error); return NextResponse.json({ error: 'Update failed' }, { status: 500 }) }
    planId = existing.id
  } else {
    const { data: created, error: insErr } = await supabase
      .from('networking_plans')
      .insert({ user_id: user.id, title: `${industry} campaign`, is_active: true, ...fields })
      .select('id')
      .single()
    if (insErr || !created) { console.error('[campaign/goal] insert error:', insErr); return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 }) }
    planId = created.id
  }

  // Write the validated slice to the profile so the sourcing loop targets it.
  const profileUpdate: Record<string, unknown> = { primary_industry: industry, interests: focus }
  if (city) profileUpdate.preferred_locations = [city]
  const { error: profErr } = await supabase.from('profiles').update(profileUpdate).eq('id', user.id)
  if (profErr) console.warn('[campaign/goal] profile slice update failed:', profErr.message)

  return NextResponse.json({ ok: true, planId })
}
