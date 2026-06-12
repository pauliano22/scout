// POST /api/campaign/autostart — internal agent-state bootstrap. The agent owns
// campaign configuration (goal type, pacing, targeting); students never see a
// form. Called after onboarding and lazily by the picks engine. Idempotent.
// Returns { ok:false, skipped } when the profile has no usable field yet — the
// home screen then falls back to sport/year matching and the inline field chip.

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'
import { ensureAgentState } from '@/lib/campaign/goal'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const planId = await ensureAgentState(auth.db, auth.userId)
    if (!planId) return NextResponse.json({ ok: false, skipped: 'no_industry' })
    return NextResponse.json({ ok: true, planId })
  } catch (e: any) {
    console.error('[campaign/autostart]', e?.message ?? e)
    return NextResponse.json({ error: 'Failed to start campaign' }, { status: 500 })
  }
}
