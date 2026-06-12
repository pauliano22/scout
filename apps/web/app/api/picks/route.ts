// GET /api/picks — today's agent-picked alumni for the signed-in student.
// Materializes lazily (accrual happens between logins, 1/day, capped) so there
// is no cron and no per-inactive-user cost. Never returns an empty payload for
// a student with any profile signal — the engine tiers down to sport/era.

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'
import { materializePicks } from '@/lib/agent/dailyPicks'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const payload = await materializePicks(auth.db, auth.userId)
    return NextResponse.json(payload)
  } catch (e: any) {
    console.error('[picks]', e?.message ?? e)
    return NextResponse.json({ error: 'Failed to load picks' }, { status: 500 })
  }
}
