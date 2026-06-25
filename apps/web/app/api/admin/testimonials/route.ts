import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'

// GET /api/admin/testimonials — list testimonials with optional featured filter
// Query params: ?featured=true|false
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const featured = request.nextUrl.searchParams.get('featured')

    let query = db.from('testimonials').select('*', { count: 'exact' })

    if (featured === 'true') {
      query = query.eq('featured', true)
    } else if (featured === 'false') {
      query = query.eq('featured', false)
    }

    const { data: testimonials, count, error } = await query
      .order('created_at', { ascending: false })

    if (error) throw error

    return ok({
      testimonials: testimonials ?? [],
      total: count ?? 0,
    })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}

// PATCH /api/admin/testimonials — toggle featured status
// Body: { id: string, featured: boolean }
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const body = await request.json()
    const { id, featured } = body

    if (!id || typeof featured !== 'boolean') {
      return fail('Missing required fields: id (string) and featured (boolean)', 400)
    }

    const { data, error } = await db
      .from('testimonials')
      .update({ featured })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return ok(data)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
