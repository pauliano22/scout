import { NextRequest } from 'next/server'
import { ApiAuthError, requireUser } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'

// GET /api/testimonials — public endpoint returning featured testimonials for landing page
export async function GET() {
  try {
    const db = serviceClient()

    const { data: testimonials, error } = await db
      .from('testimonials')
      .select('id, content, alumni_id, created_at')
      .eq('featured', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    return ok({ testimonials: testimonials ?? [] })
  } catch (e) {
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}

// POST /api/testimonials — submit a testimonial (from the alumni)
// Body: { content: string, permission_granted?: boolean }
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireUser()
    const db = serviceClient()

    const body = await request.json()
    const { content, permission_granted } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return fail('Content is required', 400)
    }

    // Find the alumni record for this user
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('alumni_id')
      .eq('id', ctx.userId)
      .single()

    if (profileError) throw profileError
    if (!profile?.alumni_id) {
      return fail('No alumni profile linked to your account', 400)
    }

    const { data: testimonial, error } = await db
      .from('testimonials')
      .insert({
        alumni_id: profile.alumni_id,
        content: content.trim(),
        source: 'web',
        permission_granted: permission_granted ?? false,
      })
      .select()
      .single()

    if (error) throw error

    return ok(testimonial)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
