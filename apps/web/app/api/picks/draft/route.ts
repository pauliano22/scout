// POST /api/picks/draft { queueId } — write the outreach draft for a pick on
// first open. Drafts are intentionally NOT pre-generated (API cost scales with
// what students actually read, not with the user base). Idempotent: returns
// the stored draft when one exists.

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'
import { draftMessage, type DraftChannel } from '@/lib/agent/draftMessage'
import { ALUMNI_COLS } from '@/lib/agent/dailyPicks'
import { mutualNote } from '@/lib/agent/outreach'
import { warmPathsFor } from '@/lib/alumni-circle'
import type { Alumni, Profile } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { queueId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const queueId = typeof body.queueId === 'string' ? body.queueId : null
  if (!queueId) return NextResponse.json({ error: 'Missing queueId' }, { status: 400 })

  const { data: row } = await auth.db
    .from('outreach_queue')
    .select(`id, draft_body, channel, message_type, alumni:alumni(${ALUMNI_COLS})`)
    .eq('id', queueId)
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (!row || !row.alumni) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const alum = row.alumni as unknown as Alumni

  // Funnel events are emitted here (not the client) so every web draft open
  // lands exactly once in user_events regardless of tab lifecycle. (Mobile
  // never hits this route — its drafts arrive inline via /api/campaign — so
  // mobile draft opens remain untracked for now.)
  const emit = (eventType: string, extra: Record<string, unknown> = {}) =>
    auth.db.from('user_events')
      .insert({ user_id: auth.userId, event_type: eventType, event_data: { queue_id: row.id, alumni_id: alum.id, ...extra } })
      .then(({ error }) => { if (error) console.error('[picks/draft] event insert failed:', eventType, error.message) })

  if ((row.draft_body as string)?.trim()) {
    await emit('pick_draft_opened', { draft_was_ready: true })
    return NextResponse.json({ draft: row.draft_body, channel: row.channel })
  }

  const { data: profile } = await auth.db
    .from('profiles').select('*').eq('id', auth.userId).single()

  // Honest name-drop: only contacts the student has actually MET, and only
  // when that contact genuinely overlapped with this alum at Cornell.
  let mutual: string | null = null
  try {
    const { data: met } = await auth.db
      .from('user_networks')
      .select('alumni_id, status')
      .eq('user_id', auth.userId)
      .in('status', ['met', 'meeting_scheduled'])
    if (met?.length) {
      const paths = await warmPathsFor([alum.id], met.map(m => ({ alumniId: m.alumni_id as string, status: m.status as string })))
      const top = paths[alum.id]
      if (top && top.topRelation === 'teammate') {
        mutual = mutualNote(top.topName, `they played together at Cornell`)
      }
    }
  } catch { /* drafting works without it */ }

  try {
    const draft = await draftMessage({
      alumni: alum,
      profile: profile as Profile,
      messageType: 'introduction',
      channel: row.channel as DraftChannel,
      mutualNote: mutual,
    })
    await emit('pick_draft_opened', { draft_was_ready: false })
    // Write only if still empty — a concurrent tap may have generated first;
    // serve whichever draft landed rather than overwriting it.
    const { data: wrote, error: writeErr } = await auth.db
      .from('outreach_queue')
      .update({ draft_body: draft })
      .eq('id', row.id)
      .eq('draft_body', '')
      .select('id')
    // Persistence failure ≠ lost race: log it (the draft is still served, but
    // every re-open regenerates at LLM cost until the write lands).
    if (writeErr) console.error('[picks/draft] write-back failed:', writeErr.message)
    if (!writeErr && !wrote?.length) {
      const { data: existing } = await auth.db
        .from('outreach_queue').select('draft_body').eq('id', row.id).single()
      const stored = (existing?.draft_body as string | undefined)?.trim()
      if (stored) return NextResponse.json({ draft: stored, channel: row.channel })
    }
    return NextResponse.json({ draft, channel: row.channel })
  } catch (e: any) {
    console.error('[picks/draft]', e?.message ?? e)
    // Failed generations previously left no artifact anywhere but Vercel logs.
    await emit('pick_draft_failed', {})
    return NextResponse.json({ error: 'Draft generation failed' }, { status: 500 })
  }
}
