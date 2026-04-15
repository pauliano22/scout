import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiAuthError, requireAlumniOrAdmin, requireUser } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import type { Opportunity, OpportunityKind, TeamCode } from '@scout/shared/types/database'

const KINDS: OpportunityKind[] = ['job', 'internship', 'mentorship', 'referral', 'other']

export async function GET(request: NextRequest) {
  try {
    await requireUser()
    const params = request.nextUrl.searchParams
    const team = params.get('team') as TeamCode | null
    const kind = params.get('kind') as OpportunityKind | null
    const activeOnly = params.get('active') !== 'false'
    const limit = Math.min(Number(params.get('limit') ?? 50), 200)

    const supabase = createClient()
    let query = supabase.from('opportunities').select('*').order('created_at', { ascending: false }).limit(limit)
    if (team) query = query.eq('team', team)
    if (kind) query = query.eq('kind', kind)
    if (activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) return fail(error.message, 500)
    return ok<Opportunity[]>((data ?? []) as Opportunity[])
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAlumniOrAdmin()
    const body = await request.json()
    const title = String(body.title ?? '').trim()
    if (!title) return fail('title required')

    const insert = {
      posted_by: ctx.userId,
      team: (body.team ?? ctx.team ?? null) as TeamCode | null,
      kind: (KINDS.includes(body.kind) ? body.kind : 'job') as OpportunityKind,
      title,
      body: body.body ?? null,
      company: body.company ?? null,
      location: body.location ?? null,
      url: body.url ?? null,
      expires_at: body.expires_at ?? null,
      is_active: true,
    }

    const supabase = createClient()
    const { data, error } = await supabase.from('opportunities').insert(insert).select('*').single()
    if (error) return fail(error.message, 400)
    return ok<Opportunity>(data as Opportunity, 201)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}
