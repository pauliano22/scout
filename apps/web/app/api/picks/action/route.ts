// POST /api/picks/action { queueId, action: 'skip' | 'save' } — act on a pick.
// skip: records a pass swipe (adaptive scoring) and dismisses the queue row.
// save: adds the alum to the student's network and records a save swipe; the
// pick stays on the card so they can still draft an intro.
// Sends go through /api/today/approve (the ledger-writing gate), not here.

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { queueId?: unknown; action?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const queueId = typeof body.queueId === 'string' ? body.queueId : null
  const action = body.action === 'skip' || body.action === 'save' ? body.action : null
  if (!queueId || !action) {
    return NextResponse.json({ error: 'Expected { queueId, action: "skip" | "save" }' }, { status: 400 })
  }

  const { data: row } = await auth.db
    .from('outreach_queue')
    .select('id, alumni_id')
    .eq('id', queueId)
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'save') {
    // Already-in-network duplicates are fine — treat as saved. Anything else
    // (RLS, FK, outage) must fail the request, not fake ok:true.
    const { error: saveErr } = await auth.db.from('user_networks')
      .insert({ user_id: auth.userId, alumni_id: row.alumni_id })
    if (saveErr && saveErr.code !== '23505') {
      console.error('[picks/action] save insert failed:', saveErr.message)
      return NextResponse.json({ error: 'Save failed' }, { status: 500 })
    }
    await auth.db.from('alumni_swipes')
      .insert({ user_id: auth.userId, alumni_id: row.alumni_id, action: 'save' })
      .then(() => {}, () => {})
    await auth.db.from('user_events')
      .insert({ user_id: auth.userId, event_type: 'pick_saved', event_data: { queue_id: row.id, alumni_id: row.alumni_id } })
      .then(() => {}, () => {})
    return NextResponse.json({ ok: true })
  }

  const { error: skipErr } = await auth.db.from('outreach_queue').update({ status: 'dismissed' }).eq('id', row.id)
  if (skipErr) {
    // A failed dismiss with ok:true leaves a zombie card blocking a cap slot.
    console.error('[picks/action] skip dismiss failed:', skipErr.message)
    return NextResponse.json({ error: 'Skip failed' }, { status: 500 })
  }
  // Feed matching: a skip is a pass signal. alumni_swipes lands with migration
  // 028 (it was referenced but never created); user_events is the durable
  // fallback either way, and the dismissed queue row already prevents re-picks.
  await auth.db.from('alumni_swipes')
    .insert({ user_id: auth.userId, alumni_id: row.alumni_id, action: 'pass' })
    .then(() => {}, () => {})
  await auth.db.from('user_events')
    .insert({ user_id: auth.userId, event_type: 'pick_skipped', event_data: { queue_id: row.id, alumni_id: row.alumni_id } })
    .then(() => {}, () => {})

  return NextResponse.json({ ok: true })
}
