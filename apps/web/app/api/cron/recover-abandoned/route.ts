// GET /api/cron/recover-abandoned — CRON_SECRET-protected.
// Finds signup sessions that never reached 'complete' and marks them for
// recovery sequence. Returns count of recoveries processed.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` ||
         req.headers.get('x-cron-secret') === secret
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfigured: missing Supabase credentials' }, { status: 500 })
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)

  try {
    // Find sessions that started signup but never reached 'complete'
    // and don't already have a recovery_sent record.
    //
    // Strategy: get all sessions with at least one event, then filter out
    // those that have hit 'complete'. Remaining sessions are "abandoned".
    const { data: allSessions, error: sessionError } = await supabase
      .from('signup_events')
      .select('session_id')

    if (sessionError) {
      console.error('[recover-abandoned] session fetch error:', sessionError)
      return NextResponse.json({ error: 'Failed to query sessions' }, { status: 500 })
    }

    // Deduplicate session IDs
    const sessionSet = new Set<string>()
    for (const row of allSessions ?? []) {
      sessionSet.add(row.session_id)
    }

    if (sessionSet.size === 0) {
      return NextResponse.json({ processed: 0 })
    }

    // Find which of these sessions reached 'complete'
    const { data: completed, error: completedError } = await supabase
      .from('signup_events')
      .select('session_id')
      .eq('step', 'complete')
      .in('session_id', Array.from(sessionSet))

    if (completedError) {
      console.error('[recover-abandoned] completed fetch error:', completedError)
      return NextResponse.json({ error: 'Failed to query completed sessions' }, { status: 500 })
    }

    const completedSessions = new Set(completed?.map((r) => r.session_id) ?? [])
    const abandonedSessions = Array.from(sessionSet).filter((s) => !completedSessions.has(s))

    if (abandonedSessions.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    // Check which abandoned sessions already have a recovery entry
    const { data: existingRecoveries } = await supabase
      .from('abandoned_registrations')
      .select('session_id')
      .in('session_id', abandonedSessions)

    const alreadyTracked = new Set(existingRecoveries?.map((r) => r.session_id) ?? [])
    const newAbandoned = abandonedSessions.filter((s) => !alreadyTracked.has(s))

    if (newAbandoned.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    // Get last event info for each abandoned session (to extract email if available)
    const { data: lastEvents } = await supabase
      .from('signup_events')
      .select('session_id, step, metadata')
      .in('session_id', newAbandoned)
      .order('created_at', { ascending: false })

    // Build recovery records grouped by session (take the most recent event per session)
    const seen = new Set<string>()
    const recoveryRecords: Array<{
      email: string
      session_id: string
      last_step: string
      recovery_sent_at: string
    }> = []

    for (const event of lastEvents ?? []) {
      if (seen.has(event.session_id)) continue
      seen.add(event.session_id)

      const meta = (event.metadata ?? {}) as Record<string, unknown>
      const email = typeof meta.email === 'string' && meta.email
        ? meta.email
        : `${event.session_id}@unknown.scout`

      recoveryRecords.push({
        email,
        session_id: event.session_id,
        last_step: event.step,
        recovery_sent_at: new Date().toISOString(),
      })
    }

    if (recoveryRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('abandoned_registrations')
        .insert(recoveryRecords)

      if (insertError) {
        console.error('[recover-abandoned] insert error:', insertError)
        return NextResponse.json({ error: 'Failed to insert recovery records' }, { status: 500 })
      }
    }

    return NextResponse.json({ processed: recoveryRecords.length })
  } catch (e: any) {
    console.error('[recover-abandoned] error:', e?.message ?? e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
