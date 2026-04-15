import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiAuthError, requireUser } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireUser()
    const supabase = createClient()
    const { error } = await supabase
      .from('opportunity_saves')
      .upsert(
        { opportunity_id: params.id, profile_id: ctx.userId },
        { onConflict: 'opportunity_id,profile_id' },
      )
    if (error) return fail(error.message, 400)
    return ok({ opportunity_id: params.id, saved: true })
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
      .from('opportunity_saves').delete()
      .eq('opportunity_id', params.id)
      .eq('profile_id', ctx.userId)
    if (error) return fail(error.message, 400)
    return ok({ opportunity_id: params.id, saved: false })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}
