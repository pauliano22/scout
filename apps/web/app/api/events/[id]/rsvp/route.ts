import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiAuthError, requireUser } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import type { EventRsvp, RsvpStatus } from '@scout/shared/types/database'

const STATUSES: RsvpStatus[] = ['going', 'maybe', 'declined']

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireUser()
    const body = await req.json().catch(() => ({}))
    const status: RsvpStatus = STATUSES.includes(body.status) ? body.status : 'going'

    const supabase = createClient()
    const { data, error } = await supabase
      .from('event_rsvps')
      .upsert(
        { event_id: params.id, profile_id: ctx.userId, status },
        { onConflict: 'event_id,profile_id' },
      )
      .select('*')
      .single()

    if (error) return fail(error.message, 400)
    return ok<EventRsvp>(data as EventRsvp)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireUser()
    const supabase = createClient()
    const { error } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('event_id', params.id)
      .eq('profile_id', ctx.userId)
    if (error) return fail(error.message, 400)
    return ok({ event_id: params.id })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}
