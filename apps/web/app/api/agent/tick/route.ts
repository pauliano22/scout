// POST /api/agent/tick — the daily agent loop (Vercel cron, x-cron-secret,
// service-role). This is the SPINE: it works the campaign BETWEEN logins.
//
// HARD GUARDRAILS (architectural, not optional):
//   - It NEVER sends and NEVER contacts anyone. It only SOURCES (writes
//     'proposed' rows — the who-to-contact gate) and DRAFTS (writes
//     outreach_queue 'queued_for_approval'). A human approves who-to-contact
//     and every send via /api/today/approve.
//   - Sourcing runs through the alumni_outreach_ledger cap (cross-user
//     over-fishing guard) and sourceAlumni's specificity gate (abstain, don't pad).
//
// Two passes per the synthesis: a FREE pure-engine sequencing pass (decides
// what's next — no LLM) and a bounded LLM sourcing+drafting pass.
//
// v1 scope notes (honest TODOs, not silent gaps): bounded batch by last_tick_at
// (no job queue); engagement-gated drafting is NOT yet implemented (pilot cohort
// is small + curated, so drafts are prepared for all active campaigns in the
// batch — revisit before widening so we don't draft for the dormant long tail);
// the ledger cap is computed in JS over a windowed read (fine at pilot scale —
// move to an RPC group-by for scale); send-logging atomicity is sequential
// service calls (move to a txn/RPC for true atomicity).
//
// Requires migrations 025 + 026. Returns a per-user summary.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  rankActions,
  OUTREACH_PER_DAY_CAP,
  SOURCING_REFILL_DAYS,
  ALUMNI_OUTREACH_MAX_STUDENTS,
  ALUMNI_OUTREACH_WINDOW_DAYS,
} from '@scout/shared/agent/nextBestAction'
import type { Profile, Alumni } from '@scout/shared/types/database'
import { assembleConnections, profileToPrefs } from '@/lib/agent/assembleQueue'
import { sourceAlumni } from '@/lib/agent/sourceAlumni'
import { draftMessage, channelForAlumni } from '@/lib/agent/draftMessage'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // raise from the 60s default for the LLM legs (Vercel Pro)

const CAMPAIGN_BATCH = 25 // users per tick (bounded; no job queue)
const MIN_APPROVED_PIPELINE = 3 // re-source when fewer approved-but-uncontacted targets remain
const DAILY_INTRO_DRAFTS = 3 // pace intros across days (≤ OUTREACH_PER_DAY_CAP)
const MS_PER_DAY = 86_400_000

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const now = new Date()

  // Active campaigns, oldest-ticked first (hand-rolled cursor; no job queue).
  const { data: campaigns, error } = await sb
    .from('networking_plans')
    .select('id, user_id, goal_metric, goal_count, current_count, last_sourced_at, sourcing_enabled')
    .eq('is_active', true)
    .eq('campaign_status', 'active')
    .order('last_tick_at', { ascending: true, nullsFirst: true })
    .limit(CAMPAIGN_BATCH)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Ledger cap set: alumni contacted by >= MAX distinct students in the window.
  const cutoff = new Date(now.getTime() - ALUMNI_OUTREACH_WINDOW_DAYS * MS_PER_DAY).toISOString()
  const { data: ledger } = await sb
    .from('alumni_outreach_ledger')
    .select('alumni_id, user_id')
    .gte('created_at', cutoff)
  const studentsPerAlum = new Map<string, Set<string>>()
  for (const r of (ledger ?? []) as any[]) {
    if (!studentsPerAlum.has(r.alumni_id)) studentsPerAlum.set(r.alumni_id, new Set())
    studentsPerAlum.get(r.alumni_id)!.add(r.user_id)
  }
  const cappedAlumni = [...studentsPerAlum.entries()]
    .filter(([, set]) => set.size >= ALUMNI_OUTREACH_MAX_STUDENTS)
    .map(([id]) => id)

  const summary: any[] = []

  for (const c of (campaigns ?? []) as any[]) {
    const userId = c.user_id as string
    const out = { userId, sourced: 0, introDrafts: 0, followupDrafts: 0, abstained: false }
    try {
      const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).single()
      const prefs = profileToPrefs(profile as Profile | null)
      const studentSport = (profile as Profile | null)?.sport ?? null

      const { signals, proposed } = await assembleConnections(sb, userId)

      // Already-networked (any status) — never re-source these.
      const { data: nets } = await sb.from('user_networks').select('alumni_id').eq('user_id', userId)
      const networkedIds = (nets ?? []).map((n: any) => n.alumni_id as string)

      // Existing queued drafts — don't re-draft.
      const { data: queued } = await sb
        .from('outreach_queue')
        .select('alumni_id, message_type')
        .eq('user_id', userId)
        .eq('status', 'queued_for_approval')
      const queuedKey = new Set((queued ?? []).map((q: any) => `${q.alumni_id}:${q.message_type}`))

      // Approved (interested), not yet contacted → need an intro.
      const approvedUncontacted = signals.filter((s) => s.status === 'interested' && !s.contacted)

      // ── SOURCE (if the approved pipeline is thin and we're due) ──────────────
      const dueToSource =
        c.sourcing_enabled !== false &&
        approvedUncontacted.length + proposed.length < MIN_APPROVED_PIPELINE &&
        (!c.last_sourced_at || now.getTime() - new Date(c.last_sourced_at).getTime() > SOURCING_REFILL_DAYS * MS_PER_DAY)

      if (dueToSource) {
        const slice = [prefs.industries.join(' / '), prefs.roles.length ? `in ${prefs.roles.join(' / ')} roles` : '']
          .filter(Boolean).join(' ')
        const searchPhrase = `${slice || 'Cornell'} alumni for informational interviews`.trim()
        const sourced = await sourceAlumni(sb, {
          searchPhrase,
          prefs,
          excludeIds: [...new Set([...networkedIds, ...cappedAlumni])],
          studentSport,
          limit: 5,
        })
        for (const s of sourced) {
          // GATE: write as 'proposed' (NOT via the plan_alumni trigger). The
          // student must approve before this becomes live outreach.
          await sb.from('user_networks').upsert(
            { user_id: userId, alumni_id: s.alumnus.id, status: 'proposed', contacted: false, notes: s.why },
            { onConflict: 'user_id,alumni_id', ignoreDuplicates: true },
          )
        }
        out.sourced = sourced.length
        out.abstained = sourced.length === 0
        await sb.from('networking_plans').update({ last_sourced_at: now.toISOString() }).eq('id', c.id)
      }

      // ── DRAFT paced intros for approved-but-uncontacted (no send) ────────────
      const goalContext = `working toward ${String(c.goal_metric).replace('_', ' ')}s${prefs.industries.length ? ` in ${prefs.industries.join('/')}` : ''}`
      let introBudget = Math.min(DAILY_INTRO_DRAFTS, OUTREACH_PER_DAY_CAP)
      for (const s of approvedUncontacted) {
        if (introBudget <= 0) break
        if (queuedKey.has(`${s.alumniId}:introduction`)) continue
        const { data: alumRow } = await sb.from('alumni').select('*').eq('id', s.alumniId).single()
        const alumnus = alumRow as Alumni | null
        if (!alumnus) continue
        const channel = channelForAlumni(alumnus)
        const body = await draftMessage({ alumni: alumnus, profile: profile as Profile, messageType: 'introduction', channel, goalContext })
        if (!body) continue
        await sb.from('outreach_queue').upsert(
          { user_id: userId, alumni_id: s.alumniId, plan_id: c.id, message_type: 'introduction', channel, draft_body: body, why: goalContext, status: 'queued_for_approval' },
          { onConflict: 'user_id,alumni_id,message_type', ignoreDuplicates: true },
        )
        out.introDrafts++
        introBudget--
      }

      // ── DRAFT follow-ups for stale threads (engine sequences; ONE per thread) ─
      const seq = rankActions(signals, now)
      const followups = seq.today.filter((a) => a.type === 'SEND_FOLLOWUP')
      for (const a of followups) {
        if (queuedKey.has(`${a.alumniId}:follow_up`)) continue
        const { data: alumRow } = await sb.from('alumni').select('*').eq('id', a.alumniId).single()
        const alumnus = alumRow as Alumni | null
        if (!alumnus) continue
        const channel = channelForAlumni(alumnus)
        const body = await draftMessage({ alumni: alumnus, profile: profile as Profile, messageType: 'follow_up', channel, goalContext })
        if (!body) continue
        await sb.from('outreach_queue').upsert(
          { user_id: userId, alumni_id: a.alumniId, plan_id: c.id, message_type: 'follow_up', channel, draft_body: body, why: a.reason, status: 'queued_for_approval' },
          { onConflict: 'user_id,alumni_id,message_type', ignoreDuplicates: true },
        )
        out.followupDrafts++
      }

      await sb.from('networking_plans').update({ last_tick_at: now.toISOString() }).eq('id', c.id)
    } catch (e: any) {
      ;(out as any).error = e?.message ?? String(e)
    }
    summary.push(out)
  }

  return NextResponse.json({ ticked: summary.length, summary })
}
