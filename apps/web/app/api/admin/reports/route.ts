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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25')))
    const status = searchParams.get('status') ?? 'flagged'
    const offset = (page - 1) * limit

    let query = db
      .from('reported_content')
      .select('*, profiles(full_name, email)', { count: 'exact' })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: reports, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return ok({
      reports: reports ?? [],
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

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = serviceClient()

    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return fail('Missing id or status', 400)
    }

    if (!['dismissed', 'removed'].includes(status)) {
      return fail('Status must be "dismissed" or "removed"', 400)
    }

    const { data, error } = await db
      .from('reported_content')
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: ctx.userId,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Log the action
    await db.from('activity_log').insert({
      user_id: ctx.userId,
      action: `report_${status}`,
      metadata: { report_id: id, content_type: data.content_type, content_id: data.content_id },
    }).maybeSingle()

    return ok(data)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
