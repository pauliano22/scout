import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const action = searchParams.get('action') ?? ''
    const offset = (page - 1) * limit

    let query = db
      .from('activity_log')
      .select('*, profiles!inner(full_name, email)', { count: 'exact' })

    if (action) {
      query = query.eq('action', action)
    }

    const { data: entries, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return ok({
      entries: entries ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
