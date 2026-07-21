// POST /api/analytics/signup — logs a signup funnel event
// GET  /api/analytics/signup — returns funnel stats (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/requestAuth'
import { checkRateLimit, getClientIp, rateLimitExceeded } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// ── POST: log a signup event ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit: public tier keyed by IP — this endpoint is pre-auth ──
    const rl = checkRateLimit(`signup-analytics:${getClientIp(request)}`, 'public')
    if (!rl.success) return rateLimitExceeded(rl)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let body: { step?: string; session_id?: string; metadata?: Record<string, unknown> }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { step, session_id, metadata = {} } = body
    if (!step || !session_id) {
      return NextResponse.json({ error: 'step and session_id are required' }, { status: 400 })
    }

    const validSteps = ['landing', 'form', 'form_engaged', 'submit_blocked', 'submit', 'verify', 'complete']
    if (!validSteps.includes(step)) {
      return NextResponse.json({ error: `step must be one of: ${validSteps.join(', ')}` }, { status: 400 })
    }

    // Landing gets the user agent stamped server-side (the client can lie, but
    // this is analytics, not auth) so IG in-app-WebView traffic is attributable.
    const enriched = step === 'landing'
      ? { ...metadata, ua: request.headers.get('user-agent')?.slice(0, 300) ?? undefined }
      : metadata

    const { error } = await supabase.from('signup_events').insert({
      session_id,
      step,
      user_id: user?.id ?? null,
      metadata: enriched,
    })

    if (error) {
      console.error('[signup] insert error:', error)
      return NextResponse.json({ error: 'Failed to log event' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[signup] POST error:', e?.message ?? e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── GET: funnel stats (admin only) ─────────────────────────────────────

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Count unique sessions per step. The select must run as service role:
    // funnel rows are inserted pre-auth with user_id NULL, so the session
    // client's own-row RLS policy sees almost nothing.
    const { data: stepCounts, error: countError } = await serviceClient()
      .from('signup_events')
      .select('step, session_id, metadata')

    if (countError) {
      console.error('[signup] stats query error:', countError)
      return NextResponse.json({ error: 'Failed to compute stats' }, { status: 500 })
    }

    const sessionsByStep = new Map<string, Set<string>>()
    const blockedSessionsByReason = new Map<string, Set<string>>()
    for (const row of stepCounts ?? []) {
      if (!sessionsByStep.has(row.step)) sessionsByStep.set(row.step, new Set())
      sessionsByStep.get(row.step)!.add(row.session_id)
      if (row.step === 'submit_blocked') {
        const reason = ((row.metadata as Record<string, unknown>)?.reason as string) ?? 'unknown'
        if (!blockedSessionsByReason.has(reason)) blockedSessionsByReason.set(reason, new Set())
        blockedSessionsByReason.get(reason)!.add(row.session_id)
      }
    }
    const blockedReasons: Record<string, number> = {}
    for (const [reason, sessions] of blockedSessionsByReason) blockedReasons[reason] = sessions.size

    const totalSessions = sessionsByStep.get('landing')?.size ?? 0
    // submit_blocked is a diagnostic, not a funnel stage — reported separately.
    const steps = ['landing', 'form', 'form_engaged', 'submit', 'verify', 'complete'].map((step) => {
      const count = sessionsByStep.get(step)?.size ?? 0
      const dropoffPct = totalSessions > 0 ? Math.round(((totalSessions - count) / totalSessions) * 100) : 0
      return { step, count, dropoff_pct: dropoffPct }
    })

    return NextResponse.json({
      total_sessions: totalSessions,
      steps,
      submit_blocked: {
        sessions: sessionsByStep.get('submit_blocked')?.size ?? 0,
        by_reason: blockedReasons,
      },
    })
  } catch (e: any) {
    console.error('[signup] GET error:', e?.message ?? e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
