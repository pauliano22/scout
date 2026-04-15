import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiAuthError, requireUser } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import type { Opportunity } from '@scout/shared/types/database'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser()
    const supabase = createClient()
    const { data, error } = await supabase.from('opportunities').select('*').eq('id', params.id).single()
    if (error) return fail(error.message, 404)
    return ok<Opportunity>(data as Opportunity)
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
      .from('opportunities').select('posted_by').eq('id', params.id).single()
    if (fetchErr || !existing) return fail('Not found', 404)
    if (!ctx.isAdmin && existing.posted_by !== ctx.userId) return fail('Forbidden', 403)

    const body = await req.json()
    const patch: Record<string, unknown> = {}
    for (const key of ['title', 'body', 'company', 'location', 'url', 'kind', 'expires_at', 'is_active', 'team'] as const) {
      if (key in body) patch[key] = body[key]
    }

    const { data, error } = await supabase.from('opportunities').update(patch).eq('id', params.id).select('*').single()
    if (error) return fail(error.message, 400)
    return ok<Opportunity>(data as Opportunity)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireUser()
    const supabase = createClient()

    const { data: existing } = await supabase
      .from('opportunities').select('posted_by').eq('id', params.id).single()
    if (!existing) return fail('Not found', 404)
    if (!ctx.isAdmin && existing.posted_by !== ctx.userId) return fail('Forbidden', 403)

    const { error } = await supabase.from('opportunities').delete().eq('id', params.id)
    if (error) return fail(error.message, 400)
    return ok({ id: params.id })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}
