import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiAuthError, requireAlumniOrAdmin, requireUser } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import type { Event, EventKind, EventVisibility, TeamCode } from '@scout/shared/types/database'

const EVENT_KINDS: EventKind[] = ['networking', 'panel', 'workshop', 'game_day', 'other']
const VISIBILITIES: EventVisibility[] = ['team', 'all']

export async function GET(request: NextRequest) {
  try {
    await requireUser()
    const supabase = createClient()
    const params = request.nextUrl.searchParams

    const team = params.get('team') as TeamCode | null
    const kind = params.get('kind') as EventKind | null
    const upcoming = params.get('upcoming') === 'true'
    const limit = Math.min(Number(params.get('limit') ?? 50), 200)

    let query = supabase.from('events').select('*').order('starts_at', { ascending: true }).limit(limit)
    if (team) query = query.eq('team', team)
    if (kind) query = query.eq('kind', kind)
    if (upcoming) query = query.gte('starts_at', new Date().toISOString())

    const { data, error } = await query
    if (error) return fail(error.message, 500)
    return ok<Event[]>((data ?? []) as Event[])
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
    const startsAt = body.starts_at
    if (!title) return fail('title required')
    if (!startsAt) return fail('starts_at required')

    const kind: EventKind = EVENT_KINDS.includes(body.kind) ? body.kind : 'networking'
    const visibility: EventVisibility = VISIBILITIES.includes(body.visibility) ? body.visibility : 'team'

    const insert = {
      title,
      description: body.description ?? null,
      starts_at: startsAt,
      ends_at: body.ends_at ?? null,
      location: body.location ?? null,
      kind,
      visibility,
      team: (body.team ?? ctx.team ?? null) as TeamCode | null,
      capacity: body.capacity ?? null,
      host_profile_id: ctx.userId,
    }

    const supabase = createClient()
    const { data, error } = await supabase.from('events').insert(insert).select('*').single()
    if (error) return fail(error.message, 400)
    return ok<Event>(data as Event, 201)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}
