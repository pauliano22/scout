// POST /api/picks/action { queueId, action: 'skip' } — skip a pick. Records a
// pass swipe so the adaptive scoring learns from it, then dismisses the queue
// row. Sends go through /api/today/approve (the ledger-writing gate), not here.

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { queueId?: unknown; action?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const queueId = typeof body.queueId === 'string' ? body.queueId : null
  if (!queueId || body.action !== 'skip') {
    return NextResponse.json({ error: 'Expected { queueId, action: "skip" }' }, { status: 400 })
  }

  const { data: row } = await auth.db
    .from('outreach_queue')
    .select('id, alumni_id')
    .eq('id', queueId)
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await auth.db.from('outreach_queue').update({ status: 'dismissed' }).eq('id', row.id)
  // Feed matching: a skip is a pass signal. alumni_swipes lands with migration
  // 028 (it was referenced but never created); user_events is the durable
  // fallback either way, and the dismissed queue row already prevents re-picks.
  await auth.db.from('alumni_swipes')
    .insert({ user_id: auth.userId, alumni_id: row.alumni_id, action: 'pass' })
    .then(() => {}, () => {})
  await auth.db.from('user_events')
    .insert({ user_id: auth.userId, event_type: 'pick_skipped', event_data: { alumni_id: row.alumni_id } })
    .then(() => {}, () => {})

  return NextResponse.json({ ok: true })
}
