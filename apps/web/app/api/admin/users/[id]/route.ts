import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await requireAdmin()
    const db = serviceClient()
    const userId = params.id

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (body.account_role !== undefined) {
      updates.account_role = body.account_role
    }
    if (body.is_verified !== undefined) {
      updates.is_verified = Boolean(body.is_verified)
    }
    if (body.is_alumni !== undefined) {
      updates.is_alumni = Boolean(body.is_alumni)
    }
    if (body.onboarding_completed !== undefined) {
      updates.onboarding_completed = Boolean(body.onboarding_completed)
    }

    if (Object.keys(updates).length === 0) {
      return fail('No valid fields to update', 400)
    }

    const { data, error } = await db
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, email, full_name, account_role, is_verified, is_alumni, onboarding_completed, created_at')
      .single()

    if (error) throw error

    // Log the activity
    const actions: string[] = []
    if (body.is_verified !== undefined) {
      actions.push(body.is_verified ? 'account_verified' : 'account_unverified')
    }
    if (body.account_role !== undefined) {
      actions.push(`role_changed_to_${body.account_role}`)
    }
    if (body.is_alumni !== undefined) {
      actions.push(`alumni_status_${body.is_alumni ? 'enabled' : 'disabled'}`)
    }

    for (const action of actions) {
      await db.from('activity_log').insert({
        user_id: userId,
        action,
        metadata: { performed_by: ctx.userId, ...body },
      }).maybeSingle()
    }

    return ok(data)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
