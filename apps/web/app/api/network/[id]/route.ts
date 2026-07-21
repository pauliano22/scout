import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Normalize any historical status value (old mobile/PATCH set OR canonical)
// into the single canonical vocabulary written to the DB (see migration 025).
const STATUS_NORMALIZE: Record<string, string> = {
  // canonical (pass-through)
  interested: 'interested',
  awaiting_reply: 'awaiting_reply',
  response_needed: 'response_needed',
  meeting_scheduled: 'meeting_scheduled',
  met: 'met',
  not_interested: 'not_interested',
  // legacy mobile / PATCH vocabulary → canonical
  saved: 'interested',
  message_drafted: 'interested',
  active: 'interested',
  contacted: 'awaiting_reply',
  replied: 'response_needed',
  meeting_set: 'meeting_scheduled',
}
// Statuses that imply the alum has already been contacted.
const CONTACTED_STATUSES = new Set(['awaiting_reply', 'response_needed', 'meeting_scheduled', 'met'])
// Statuses that imply the alum has replied (powers reply-rate metrics, migration 054).
const REPLIED_STATUSES = new Set(['response_needed', 'meeting_scheduled', 'met'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authHeader = request.headers.get('Authorization')
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: { user }, error: authError } = await serviceClient.auth.getUser(accessToken)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if ('status' in body) {
    if (typeof body.status !== 'string' || !(body.status in STATUS_NORMALIZE)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = STATUS_NORMALIZE[body.status]
  }

  // Manual meeting-date affordance (Component C). Setting a date implies the
  // connection has reached the meeting_scheduled stage.
  if ('meeting_at' in body) {
    if (body.meeting_at !== null && typeof body.meeting_at !== 'string') {
      return NextResponse.json({ error: 'Invalid meeting_at' }, { status: 400 })
    }
    updates.meeting_at = body.meeting_at
    if (body.meeting_at) {
      updates.status = 'meeting_scheduled'
    }
  }

  if ('notes' in body) {
    if (body.notes !== null && typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'Invalid notes' }, { status: 400 })
    }
    updates.notes = body.notes
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Stamp the first-touch timestamps the (possibly meeting_at-derived) status
  // implies. This route used to overwrite contacted_at on every status write
  // and never set replied_at at all, which blinded the AD report's reply
  // metrics — timestamps only move null → now, never later.
  if (typeof updates.status === 'string' && CONTACTED_STATUSES.has(updates.status)) {
    const { data: current, error: curErr } = await serviceClient
      .from('user_networks')
      .select('contacted_at, replied_at')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (curErr) {
      console.error('[network/patch] pre-select error:', curErr)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
    if (!current) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    updates.contacted = true
    if (!current.contacted_at) updates.contacted_at = new Date().toISOString()
    if (REPLIED_STATUSES.has(updates.status) && !current.replied_at) {
      updates.replied_at = new Date().toISOString()
    }
  }

  const { data, error } = await serviceClient
    .from('user_networks')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id) // ownership check via filter, not separate query
    .select('id, status, notes, contacted, contacted_at, replied_at, meeting_at')
    .single()

  if (error) {
    console.error('[network/patch] error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
