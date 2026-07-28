// GET /api/admin/recruiting — the recruiting worklist: every current
// student-athlete, overlaid with CRM state, signup matching, and activation.
// Works read-only (crmReady=false) before migration 070 is applied.

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { checkRateLimit, addRateLimitHeaders, rateLimitExceeded } from '@/lib/rate-limit'
import { loadRecruitingBundle, filterRows, sortRows } from '@/lib/recruiting/merge'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const rl = checkRateLimit(`admin:${ip || 'admin'}`, 'admin')
    if (!rl.success) return rateLimitExceeded(rl)

    const sp = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50')))
    const sort = sp.get('sort') ?? 'priority'
    const team = sp.get('team') ?? ''

    const bundle = await loadRecruitingBundle(db)
    const filtered = filterRows(bundle.rows, {
      search: sp.get('search') ?? '',
      team,
      year: sp.get('year') ?? '',
      stage: sp.get('stage') ?? 'all',
      focus: sp.get('focus') === '1',
    })
    const sorted = sortRows(filtered, sort, Boolean(team))

    const offset = (page - 1) * limit
    return addRateLimitHeaders(
      ok({
        prospects: sorted.slice(offset, offset + limit),
        total: sorted.length,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(sorted.length / limit)),
        crmReady: bundle.crmReady,
      }),
      rl,
    )
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
