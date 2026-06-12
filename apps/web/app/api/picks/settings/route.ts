// PATCH /api/picks/settings { field?, city?, paused? } — the quiet preferences
// sheet behind the picks home. Field/city update targeting; paused toggles
// sourcing. This is the entire user-facing surface of campaign configuration.

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'
import { isValidIndustry } from '@/lib/campaign/industries'
import { ensureAgentState } from '@/lib/campaign/goal'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { field?: unknown; city?: unknown; paused?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const profileUpdate: Record<string, unknown> = {}
  if (typeof body.field === 'string' && isValidIndustry(body.field)) {
    profileUpdate.primary_industry = body.field
  }
  if (typeof body.city === 'string') {
    const city = body.city.trim().slice(0, 60)
    profileUpdate.preferred_locations = city ? [city] : []
    profileUpdate.geography_preference = city ? 'city' : 'doesnt_matter'
  }
  if (Object.keys(profileUpdate).length) {
    await auth.db.from('profiles').update(profileUpdate).eq('id', auth.userId)
  }

  if (typeof body.paused === 'boolean') {
    await auth.db.from('networking_plans')
      .update({ sourcing_enabled: !body.paused })
      .eq('user_id', auth.userId)
      .eq('is_active', true)
  }

  await ensureAgentState(auth.db, auth.userId)
  return NextResponse.json({ ok: true })
}
