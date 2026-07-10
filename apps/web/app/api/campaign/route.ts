// GET /api/campaign — the agentic campaign-home payload for the signed-in
// student. One fetch returns: the campaign goal + progress, the cron-prepared
// drafts ready to review/send, the who-to-contact approval shelf, and the muted
// "waiting on replies" set. Reuses the shared assembleConnections so this view
// and the between-login loop never drift. NO sending happens here.
//
// Degrades soft before migration 026 is applied (campaign=null, ready=[]).

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'
import { rankActions, type SuggestedAction } from '@scout/shared/agent/nextBestAction'
import { assembleConnections } from '@/lib/agent/assembleQueue'
import { materializePicks, ALUMNI_COLS } from '@/lib/agent/dailyPicks'
import type { Alumni } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'

const MS_PER_WEEK = 7 * 86_400_000

export async function GET(request: Request) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, db: supabase } = auth
  const user = { id: userId }

  // Run the daily-picks accrual before assembling the payload. The mobile
  // client only ever calls this route (never /api/picks), so without this a
  // phone-only student never accrues picks — the queue read below just
  // re-serves whatever an old web visit minted. Lazy + idempotent; failure
  // must not take down the campaign screen.
  try {
    await materializePicks(supabase, user.id)
  } catch (e: any) {
    console.warn('[campaign] picks materialization failed:', e?.message ?? e)
  }

  // ── Proposed shelf + waiting, via the shared assembly (the gate lives here) ─
  let assembled
  try {
    assembled = await assembleConnections(supabase, user.id)
  } catch (e: any) {
    console.warn('[campaign] assembly error:', e?.message ?? e)
    return NextResponse.json({ error: 'Failed to load campaign' }, { status: 500 })
  }
  const { signals, overrides, display, proposed } = assembled
  const queue = rankActions(signals, new Date(), overrides)
  const hydrate = (a: SuggestedAction) => ({
    ...a,
    networkId: display.get(a.alumniId)?.networkId ?? null,
    alumnus: display.get(a.alumniId)?.alumnus ?? null,
  })

  // ── Ready-to-send: cron-prepared drafts awaiting the student's send ─────────
  let ready: any[] = []
  try {
    // Explicit columns — alumni(*) would drag the pgvector embedding along
    // (1536 floats/row; see the warning on ALUMNI_COLS).
    const { data: rows } = await supabase
      .from('outreach_queue')
      .select(`id, alumni_id, channel, message_type, draft_body, why, status, created_at, alumni:alumni(${ALUMNI_COLS})`)
      .eq('user_id', user.id)
      .eq('status', 'queued_for_approval')
      .order('created_at', { ascending: true })
    ready = (rows ?? [])
      .map((r: any) => ({
        queueId: r.id,
        channel: r.channel,
        messageType: r.message_type,
        draftBody: r.draft_body,
        why: r.why ?? null,
        alumnus: (r.alumni as Alumni) ?? null,
      }))
      .filter((r: any) => r.alumnus)
  } catch (e: any) {
    console.warn('[campaign] outreach_queue read failed (migration 026 applied?):', e?.message ?? e)
  }

  // ── Campaign goal + progress (null → the client shows the goal-setting step) ─
  let campaign: any = null
  try {
    const { data: plan } = await supabase
      .from('networking_plans')
      .select('id, goal_metric, goal_count, deadline, campaign_status, current_count')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (plan && plan.deadline) {
      const booked = signals.filter((s) => s.status === 'met').length
      const meetingsSet = signals.filter((s) => s.status === 'meeting_scheduled').length
      const weeksLeft = Math.max(0, Math.ceil((new Date(plan.deadline).getTime() - Date.now()) / MS_PER_WEEK))
      campaign = {
        goalMetric: plan.goal_metric ?? 'informational_interview',
        goalCount: plan.goal_count ?? 0,
        deadline: plan.deadline,
        status: plan.campaign_status ?? 'active',
        booked,
        meetingsSet,
        weeksLeft,
      }
    }
  } catch (e: any) {
    console.warn('[campaign] plan read failed:', e?.message ?? e)
  }

  return NextResponse.json({
    campaign,
    ready,
    proposed: proposed.map((p) => ({ networkId: p.networkId, alumnus: p.alumnus, why: p.why })),
    waiting: queue.waiting.map(hydrate),
  })
}
