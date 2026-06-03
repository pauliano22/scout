// POST /api/today/override — record a dismiss/snooze on a derived action.
// Upserts a connection_action_state row (one per user+alumni+action_type).
// Mobile writes go through this web route (monorepo rule). No sending.
//
// Body: { alumniId: string, actionType: ActionType, state: 'dismissed'|'snoozed', snoozeDays?: number }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ACTION_TYPES = new Set(['DRAFT_INTRO', 'SEND_FOLLOWUP', 'RESPOND', 'PREP_MEETING', 'SEND_THANKYOU'])
const DEFAULT_SNOOZE_DAYS = 3

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: { user }, error: authErr } = await sc.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const alumniId = typeof body.alumniId === 'string' ? body.alumniId : null
  const actionType = typeof body.actionType === 'string' ? body.actionType : ''
  const state = body.state
  if (!alumniId || !ACTION_TYPES.has(actionType)) {
    return NextResponse.json({ error: 'Invalid alumniId or actionType' }, { status: 400 })
  }
  if (state !== 'dismissed' && state !== 'snoozed') {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  const snoozeDays = typeof body.snoozeDays === 'number' && body.snoozeDays > 0 ? body.snoozeDays : DEFAULT_SNOOZE_DAYS
  const snooze_until = state === 'snoozed'
    ? new Date(Date.now() + snoozeDays * 86_400_000).toISOString()
    : null

  // Ownership enforced via user_id (service client bypasses RLS, same pattern
  // as the network PATCH route). RLS still guards direct client access.
  const { error } = await sc.from('connection_action_state').upsert(
    {
      user_id: user.id,
      alumni_id: alumniId,
      action_type: actionType,
      state,
      snooze_until,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,alumni_id,action_type' },
  )
  if (error) {
    console.error('[today/override] error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
