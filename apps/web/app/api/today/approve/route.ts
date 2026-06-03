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
      .select('id')
      .maybeSingle()
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found or already approved' }, { status: 404 })
    return NextResponse.json({ ok: true, approved: data.id })
  }

  // ── Log a send the student just made (copy/mailto client-side) ─────────────
  if (body.action === 'send') {
    const queueId = typeof body.queueId === 'string' ? body.queueId : null
    if (!queueId) return NextResponse.json({ error: 'Missing queueId' }, { status: 400 })

    const { data: q, error: qErr } = await sb
      .from('outreach_queue')
      .select('id, alumni_id, channel, draft_body, status')
      .eq('id', queueId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (qErr || !q) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    if (q.status !== 'queued_for_approval') return NextResponse.json({ error: 'Already actioned' }, { status: 409 })

    const nowIso = new Date().toISOString()
    // 1. mark the queue row sent
    await sb.from('outreach_queue').update({ status: 'approved_sent', sent_at: nowIso }).eq('id', queueId).eq('user_id', user.id)
    // 2. log the outbound (authoritative loop state regardless of channel observability)
    await sb.from('messages').insert({
      user_id: user.id,
      alumni_id: q.alumni_id,
      message_content: q.draft_body,
      sent_via: q.channel === 'email' ? 'email' : 'linkedin',
    })
    // 3. advance the connection
    await sb.from('user_networks')
      .update({ status: 'awaiting_reply', contacted: true, contacted_at: nowIso })
      .eq('user_id', user.id)
      .eq('alumni_id', q.alumni_id)
    // 4. record the cross-user contact event (cap counts distinct students per alum)
    await sb.from('alumni_outreach_ledger').upsert(
      { alumni_id: q.alumni_id, user_id: user.id },
      { onConflict: 'alumni_id,user_id', ignoreDuplicates: true },
    )
    return NextResponse.json({ ok: true, sent: queueId })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
