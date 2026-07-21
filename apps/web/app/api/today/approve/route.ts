// POST /api/today/approve — the HUMAN-IN-THE-LOOP gate. The cron never sends or
// contacts; this is the only place a student promotes a sourced alum or logs a
// send. Two actions:
//   { action: 'approve_target', networkId }  → flip a 'proposed' alum to
//        'interested' (who-to-contact approval). Now the loop may draft an intro.
//   { action: 'send', queueId }              → the student approved+sent a draft
//        (copy/mailto happens client-side). Log it: mark the queue row sent,
//        write the messages row, flip the connection to awaiting_reply, and
//        record the alumni_outreach_ledger contact event (the cross-user cap).
//
// Mobile/web both call this with the user's bearer token (service client +
// explicit ownership filter, same pattern as /api/network/[id]).
//
// NOTE: the send path is sequential service calls; move to a txn/RPC for true
// atomicity. Requires migration 026.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.startsWith('Bearer ')
    ? request.headers.get('Authorization')!.slice(7)
    : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // ── Approve who-to-contact: 'proposed' → 'interested' ──────────────────────
  if (body.action === 'approve_target') {
    const networkId = typeof body.networkId === 'string' ? body.networkId : null
    if (!networkId) return NextResponse.json({ error: 'Missing networkId' }, { status: 400 })
    const { data, error } = await sb
      .from('user_networks')
      .update({ status: 'interested' })
      .eq('id', networkId)
      .eq('user_id', user.id)
      .eq('status', 'proposed') // only promote a still-proposed row
      .select('id, alumni_id')
      .maybeSingle()
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found or already approved' }, { status: 404 })
    // Record the cross-user cap contact event at ADD-TO-OUTREACH (the send proxy):
    // the alum now counts toward the per-alum ceiling. Idempotent per (alum, user).
    const { error: ledgerErr } = await sb.from('alumni_outreach_ledger').upsert(
      { alumni_id: data.alumni_id, user_id: user.id },
      { onConflict: 'alumni_id,user_id', ignoreDuplicates: true },
    )
    if (ledgerErr) console.error('today/approve: ledger upsert failed (cap may leak)', { alumni_id: data.alumni_id, user_id: user.id, error: ledgerErr.message })
    return NextResponse.json({ ok: true, approved: data.id })
  }

  // ── Decline a proposed alum: 'proposed' → 'not_interested' (won't be re-sourced) ──
  if (body.action === 'dismiss_target') {
    const networkId = typeof body.networkId === 'string' ? body.networkId : null
    if (!networkId) return NextResponse.json({ error: 'Missing networkId' }, { status: 400 })
    const { data, error } = await sb
      .from('user_networks')
      .update({ status: 'not_interested' })
      .eq('id', networkId)
      .eq('user_id', user.id)
      .eq('status', 'proposed')
      .select('id')
      .maybeSingle()
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found or already actioned' }, { status: 404 })
    return NextResponse.json({ ok: true, declined: data.id })
  }

  // ── Log a send the student just made (copy/mailto client-side) ─────────────
  if (body.action === 'send') {
    const queueId = typeof body.queueId === 'string' ? body.queueId : null
    if (!queueId) return NextResponse.json({ error: 'Missing queueId' }, { status: 400 })
    // The student may have edited the draft in the compose modal — log what they
    // actually sent, not the original. Falls back to the queued draft.
    const editedBody = typeof body.editedBody === 'string' && body.editedBody.trim() ? body.editedBody : null
    const SENT_VIA = ['linkedin', 'email', 'copied', 'marked']
    const sentVia = typeof body.sentVia === 'string' && SENT_VIA.includes(body.sentVia) ? body.sentVia : null

    const { data: q, error: qErr } = await sb
      .from('outreach_queue')
      .select('id, alumni_id, channel, draft_body, status')
      .eq('id', queueId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (qErr || !q) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    if (q.status !== 'queued_for_approval') return NextResponse.json({ error: 'Already actioned' }, { status: 409 })

    const nowIso = new Date().toISOString()
    // 1. mark the queue row sent — gating write; fail loudly if it doesn't land so
    //    we never report a send that wasn't recorded. The status filter re-checks
    //    atomically: of two concurrent sends (double-click), exactly one row
    //    comes back here, so the messages insert and pick_sent event fire once.
    const { data: sentRows, error: queueErr } = await sb
      .from('outreach_queue')
      .update({ status: 'approved_sent', sent_at: nowIso })
      .eq('id', queueId)
      .eq('user_id', user.id)
      .eq('status', 'queued_for_approval')
      .select('id')
    if (queueErr) return NextResponse.json({ error: 'Failed to record send' }, { status: 500 })
    if (!sentRows?.length) return NextResponse.json({ error: 'Already actioned' }, { status: 409 })
    // 2. log the outbound (authoritative loop state regardless of channel observability)
    const { error: msgErr } = await sb.from('messages').insert({
      user_id: user.id,
      alumni_id: q.alumni_id,
      message_content: editedBody ?? q.draft_body,
      sent_via: sentVia ?? (q.channel === 'email' ? 'email' : 'linkedin'),
    })
    if (msgErr) console.error('today/approve: messages insert failed', msgErr)
    // 3. advance the connection — a silent failure here diverges the Network
    // board from the queue (row stays 'interested' after a real send).
    // contacted_at is a first-touch marker: preserve an existing value so a
    // repeat send never resets the reply-time clock.
    const { data: net } = await sb.from('user_networks')
      .select('contacted_at')
      .eq('user_id', user.id)
      .eq('alumni_id', q.alumni_id)
      .maybeSingle()
    const advance: Record<string, unknown> = { status: 'awaiting_reply', contacted: true }
    if (!net?.contacted_at) advance.contacted_at = nowIso
    const { error: netErr } = await sb.from('user_networks')
      .update(advance)
      .eq('user_id', user.id)
      .eq('alumni_id', q.alumni_id)
    if (netErr) console.error('today/approve: user_networks advance failed', netErr.message)
    // 4. record the cross-user contact event (cap counts distinct students per alum)
    const { error: ledgerErr } = await sb.from('alumni_outreach_ledger').upsert(
      { alumni_id: q.alumni_id, user_id: user.id },
      { onConflict: 'alumni_id,user_id', ignoreDuplicates: true },
    )
    if (ledgerErr) console.error('today/approve: ledger upsert failed (cap may leak)', { alumni_id: q.alumni_id, user_id: user.id, error: ledgerErr.message })
    // 5. funnel event — emitted here (not the client) so web and mobile sends
    // both land exactly once, even if the tab closes mid-response.
    await sb.from('user_events')
      .insert({ user_id: user.id, event_type: 'pick_sent', event_data: { queue_id: queueId, alumni_id: q.alumni_id, sent_via: sentVia ?? (q.channel === 'email' ? 'email' : 'linkedin') } })
      .then(({ error }) => { if (error) console.error('today/approve: pick_sent event insert failed', error.message) })
    return NextResponse.json({ ok: true, sent: queueId })
  }

  // ── Dismiss a queued draft (student chose not to send it) ──────────────────
  if (body.action === 'dismiss_draft') {
    const queueId = typeof body.queueId === 'string' ? body.queueId : null
    if (!queueId) return NextResponse.json({ error: 'Missing queueId' }, { status: 400 })
    const { data, error } = await sb
      .from('outreach_queue')
      .update({ status: 'dismissed' })
      .eq('id', queueId)
      .eq('user_id', user.id)
      .eq('status', 'queued_for_approval') // only dismiss a still-pending draft
      .select('id')
      .maybeSingle()
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found or already actioned' }, { status: 404 })
    return NextResponse.json({ ok: true, dismissed: data.id })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
