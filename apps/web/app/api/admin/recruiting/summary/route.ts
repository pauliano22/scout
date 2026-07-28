// GET /api/admin/recruiting/summary — stage totals, stalled/due counts, and
// per-team penetration rollups (focus-pinned teams first, least-penetrated
// next). Works read-only before migration 070 is applied.

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { checkRateLimit, addRateLimitHeaders, rateLimitExceeded } from '@/lib/rate-limit'
import { loadRecruitingBundle, computeSummary } from '@/lib/recruiting/merge'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const rl = checkRateLimit(`admin:${ip || 'admin'}`, 'admin')
    if (!rl.success) return rateLimitExceeded(rl)

    const bundle = await loadRecruitingBundle(db)
    const summary = computeSummary(bundle.rows, bundle.teamsState)

    return addRateLimitHeaders(ok({ crmReady: bundle.crmReady, ...summary }), rl)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
