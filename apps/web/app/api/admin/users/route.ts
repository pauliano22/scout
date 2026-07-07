import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import {
  checkRateLimit,
  addRateLimitHeaders,
  rateLimitExceeded,
} from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    // ── Rate limit: admin tier (300 req/min) keyed by caller IP ──
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const rl = checkRateLimit(`admin:${ip || 'admin'}`, 'admin')
    if (!rl.success) return rateLimitExceeded(rl)

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25')))
    const search = searchParams.get('search') ?? ''
    const role = searchParams.get('role') ?? ''
    const status = searchParams.get('status') ?? ''
    const offset = (page - 1) * limit

    // Build query
    let query = db.from('profiles').select('*', { count: 'exact' })

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }
    if (role) {
      query = query.eq('account_role', role)
    }
    if (status === 'verified') {
      query = query.eq('is_verified', true)
    } else if (status === 'unverified') {
      query = query.eq('is_verified', false)
    } else if (status === 'alumni') {
      query = query.eq('is_alumni', true)
    }

    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return addRateLimitHeaders(ok({
      users: users ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    }), rl)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
