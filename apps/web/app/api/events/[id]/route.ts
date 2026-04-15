import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiAuthError, requireAdmin, requireUser } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import type { Event } from '@scout/shared/types/database'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser()
    const supabase = createClient()
    const { data, error } = await supabase.from('events').select('*').eq('id', params.id).single()
    if (error) return fail(error.message, 404)
    return ok<Event>(data as Event)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireUser()
    const supabase = createClient()

    const { data: existing, error: fetchErr } = await supabase
      .from('events').select('host_profile_id').eq('id', params.id).single()
    if (fetchErr || !existing) return fail('Event not found', 404)
    if (!ctx.isAdmin && existing.host_profile_id !== ctx.userId) return fail('Forbidden', 403)

    const body = await req.json()
    const patch: Record<string, unknown> = {}
    for (const key of ['title', 'description', 'starts_at', 'ends_at', 'location', 'kind', 'visibility', 'capacity', 'is_cancelled'] as const) {
      if (key in body) patch[key] = body[key]
    }

    const { data, error } = await supabase.from('events').update(patch).eq('id', params.id).select('*').single()
    if (error) return fail(error.message, 400)
    return ok<Event>(data as Event)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()
    const supabase = createClient()
    const { error } = await supabase.from('events').delete().eq('id', params.id)
    if (error) return fail(error.message, 400)
    return ok({ id: params.id })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}
