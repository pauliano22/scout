import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ok, fail } from '@/lib/api/respond'

/**
 * POST /api/activity/log
 * Logs a user activity entry (signup, login, profile_update).
 * Called from client-side pages after a user action completes.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return fail('Not authenticated', 401)
    }

    const body = await request.json()
    const { action, metadata } = body

    if (!action || typeof action !== 'string') {
      return fail('Missing or invalid action', 400)
    }

    const allowedActions = [
      'signup',
      'login',
      'profile_update',
    ]

    if (!allowedActions.includes(action)) {
      return fail(`Action "${action}" is not allowed`, 400)
    }

    const { error } = await supabase
      .from('activity_log')
      .insert({
        user_id: user.id,
        action,
        metadata: metadata ?? {},
      })

    if (error) throw error

    return ok({ logged: true })
  } catch (e) {
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
