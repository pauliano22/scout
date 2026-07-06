// GET /api/admin/verification — list flagged graduation year mismatches
// PATCH /api/admin/verification — mark a verification as reviewed
//
// Auth: requireAdmin() enforced server-side on every method (the admin layout
// check is client-only and does not protect this route). Service role is used
// only after the admin gate passes, to read across all alumni rows.

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const sb = serviceClient()

    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)))
    const offset = (page - 1) * limit
    const status = url.searchParams.get('status') // optional filter: 'mismatch' | 'verified' | 'unverified' | 'pending'

    let query = sb
      .from('graduation_verification')
      .select(`
        *,
        alumni:alumni_id (
          id,
          full_name,
          email,
          sport,
          graduation_year,
          company,
          role
        )
      `, { count: 'exact' })

    if (status) {
      query = query.eq('match_status', status)
    }

    // Default: show un-reviewed mismatches first, then all others
    const { data, error, count } = await query
      .order('flagged_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[admin/verification] query failed:', error.message)
      return fail(error.message, 500)
    }

    return ok({
      verifications: data ?? [],
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
    await requireAdmin()
    const sb = serviceClient()

    let body: { id?: string } = {}
    try {
      body = await request.json()
    } catch {
      return fail('Invalid JSON body', 400)
    }

    const { id } = body
    if (!id) {
      return fail('Missing verification id', 400)
    }

    const { error } = await sb
      .from('graduation_verification')
      .update({ reviewed: true })
      .eq('id', id)

    if (error) {
      console.error('[admin/verification] update failed:', error.message)
      return fail(error.message, 500)
    }

    return ok({ success: true })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
