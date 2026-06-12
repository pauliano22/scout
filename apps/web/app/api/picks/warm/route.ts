// POST /api/picks/warm { field?, city? } — fired the moment a student selects
// their field during onboarding. Saves the targeting slice, ensures agent
// state, and materializes the first picks synchronously — so by the time the
// student finishes onboarding, home is already populated.

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'
import { isValidIndustry } from '@/lib/campaign/industries'
import { materializePicks } from '@/lib/agent/dailyPicks'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { field?: unknown; city?: unknown }
  try { body = await request.json() } catch { body = {} }

  const update: Record<string, unknown> = {}
  if (typeof body.field === 'string' && isValidIndustry(body.field)) update.primary_industry = body.field
  if (typeof body.city === 'string' && body.city.trim()) {
    update.preferred_locations = [body.city.trim().slice(0, 60)]
    update.geography_preference = 'city'
  }
  if (Object.keys(update).length) {
    await auth.db.from('profiles').update(update).eq('id', auth.userId)
  }

  try {
    const payload = await materializePicks(auth.db, auth.userId)
    return NextResponse.json({ ok: true, warmed: payload.picks.length })
  } catch (e: any) {
    console.error('[picks/warm]', e?.message ?? e)
    return NextResponse.json({ ok: false })
  }
}
