// PATCH /api/admin/recruiting/teams — per-team campaign state: the focus pin
// and the strategy notes ("captains, entry points, locker-room angle").

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { checkRateLimit, addRateLimitHeaders, rateLimitExceeded } from '@/lib/rate-limit'
import { isMissingTableError, MIGRATION_HINT } from '@/lib/recruiting/errors'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const rl = checkRateLimit(`admin:${ip || 'admin'}`, 'admin')
    if (!rl.success) return rateLimitExceeded(rl)

    let body: { team_key?: string; is_focus?: boolean; strategy_notes?: string | null } = {}
    try {
      body = await request.json()
    } catch {
      return fail('Invalid JSON body', 400)
    }
    if (!body.team_key?.trim()) return fail('Missing team_key', 400)

    const patch: Record<string, unknown> = { team_key: body.team_key }
    if (body.is_focus !== undefined) patch.is_focus = body.is_focus
    if (body.strategy_notes !== undefined) patch.strategy_notes = body.strategy_notes || null

    const { data: team, error } = await db
      .from('recruiting_teams')
      .upsert(patch, { onConflict: 'team_key' })
      .select()
      .single()
    if (error) {
      if (isMissingTableError(error)) return fail(MIGRATION_HINT, 409)
      throw error
    }

    return addRateLimitHeaders(ok({ team }), rl)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
