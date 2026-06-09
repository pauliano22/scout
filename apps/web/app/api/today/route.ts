// GET /api/today — the ranked "Next Best Action" queue for the signed-in user.
//
// Thin wrapper over the shared assembly (lib/agent/assembleQueue) that the cron
// also uses, so the live view and the between-login loop never drift. Returns
// the ranked today/later/waiting buckets PLUS the `proposed` approval shelf
// (cron-sourced alumni awaiting the student's who-to-contact OK).
//
// Requires migrations 025 (meeting_at + connection_action_state) and 026
// (proposed status). No sending happens here.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankActions, type SuggestedAction } from '@scout/shared/agent/nextBestAction'
import { assembleConnections } from '@/lib/agent/assembleQueue'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let assembled
  try {
    assembled = await assembleConnections(supabase, user.id)
  } catch (e: any) {
    console.warn('[today] assembly error:', e?.message ?? e)
    return NextResponse.json({ error: 'Failed to load network' }, { status: 500 })
  }
  const { signals, overrides, display, proposed } = assembled

  const queue = rankActions(signals, new Date(), overrides)
  const hydrate = (a: SuggestedAction) => ({
    ...a,
    networkId: display.get(a.alumniId)?.networkId ?? null,
    alumnus: display.get(a.alumniId)?.alumnus ?? null,
  })

  return NextResponse.json({
    today: queue.today.map(hydrate),
    later: queue.later.map(hydrate),
    waiting: queue.waiting.map(hydrate),
    // The who-to-contact approval shelf — "Scout lined these up for you to OK".
    proposed: proposed.map((p) => ({ networkId: p.networkId, alumnus: p.alumnus, why: p.why })),
  })
}
