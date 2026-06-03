// GET /api/today — the ranked "Next Best Action" queue for the signed-in user.
//
// Platform-agnostic server contract: both the mobile "Today" surface and any
// web view consume this. Assembles each saved connection's reliable signals
// (user_networks + last outbound message + meeting_at) plus dismiss/snooze
// overrides, runs the pure engine (@scout/shared/agent/nextBestAction), and
// returns the ranked today / later / waiting buckets with hydrated alumni.
//
// NOTE: requires migration 025 (meeting_at column + connection_action_state
// table). No sending happens here — actions are surfaced for one-tap compose.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scoreAlumnus, type UserPreferences } from '@scout/shared/scoring/recommendationScoring'
import {
  rankActions,
  type ConnectionSignals,
  type ActionOverride,
  type SuggestedAction,
} from '@scout/shared/agent/nextBestAction'
import type { Alumni, Profile } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'

function profileToPrefs(p: Profile | null): UserPreferences {
  const industries = [p?.primary_industry, ...(p?.secondary_industries ?? [])].filter(
    (v): v is string => Boolean(v),
  )
  return {
    industries,
    sports: p?.sport ? [p.sport] : [],
    locations: p?.preferred_locations ?? [],
    roles: p?.target_roles ?? [],
    companies: [],
    priorities: { sameSport: false, similarIndustry: true, seniorAlumni: false },
  }
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Saved connections (+ joined alumni for fit scoring and display).
  const { data: nets, error: netErr } = await supabase
    .from('user_networks')
    .select('id, alumni_id, status, contacted, contacted_at, meeting_at, alumni:alumni(*)')
    .eq('user_id', user.id)
  if (netErr) {
    console.warn('[today] user_networks error:', netErr.message)
    return NextResponse.json({ error: 'Failed to load network' }, { status: 500 })
  }

  // Most recent OUTBOUND message per alumni → lastMessageAt.
  const { data: msgs } = await supabase
    .from('messages')
    .select('alumni_id, created_at')
    .eq('user_id', user.id)
  const lastMsg = new Map<string, string>()
  for (const m of msgs ?? []) {
    const prev = lastMsg.get(m.alumni_id as string)
    const at = m.created_at as string
    if (!prev || at > prev) lastMsg.set(m.alumni_id as string, at)
  }

  // Dismiss/snooze overrides.
  const { data: ovr } = await supabase
    .from('connection_action_state')
    .select('alumni_id, action_type, state, snooze_until')
    .eq('user_id', user.id)
  const overrides: ActionOverride[] = (ovr ?? []).map((o: any) => ({
    alumniId: o.alumni_id,
    actionType: o.action_type,
    state: o.state,
    snoozeUntil: o.snooze_until,
  }))

  // Profile → preferences for the fit-score tie-break.
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const prefs = profileToPrefs(profile as Profile | null)

  const now = new Date()
  const display = new Map<string, { networkId: string; alumnus: Alumni }>()
  const signals: ConnectionSignals[] = (nets ?? []).map((n: any) => {
    const alumnus = n.alumni as Alumni
    if (alumnus) display.set(n.alumni_id, { networkId: n.id, alumnus })
    return {
      alumniId: n.alumni_id,
      status: n.status ?? null,
      contacted: !!n.contacted,
      contactedAt: n.contacted_at,
      lastMessageAt: lastMsg.get(n.alumni_id) ?? null,
      meetingAt: n.meeting_at ?? null,
      fitScore: alumnus ? scoreAlumnus(alumnus, prefs, {}).score : 0,
    }
  })

  const queue = rankActions(signals, now, overrides)
  const hydrate = (a: SuggestedAction) => ({
    ...a,
    networkId: display.get(a.alumniId)?.networkId ?? null,
    alumnus: display.get(a.alumniId)?.alumnus ?? null,
  })

  return NextResponse.json({
    today: queue.today.map(hydrate),
    later: queue.later.map(hydrate),
    waiting: queue.waiting.map(hydrate),
  })
}
