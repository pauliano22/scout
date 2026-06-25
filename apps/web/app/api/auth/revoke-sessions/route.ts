// POST /api/auth/revoke-sessions
// Revokes all active sessions for the current user.
// Called on password change or when the user wants to force-logout all devices.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = createClient()

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Revoke all active sessions for this user
  const { error: updateError } = await supabase
    .from('sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('revoked_at', null)

  if (updateError) {
    console.error('[revoke-sessions] Failed to revoke sessions:', updateError.message)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: 'All sessions revoked. Please log in again.',
  })
}
