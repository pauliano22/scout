// GET /api/cron/cleanup-sessions — Vercel cron endpoint that deletes
// expired and revoked sessions older than 7 days (keeps a grace window
// for auditing).
//
// Protected by CRON_SECRET (sent as `authorization: Bearer ***` or
// `x-cron-secret` header).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Delete sessions that expired more than 7 days ago
  // (grace period so we don't lose audit trail immediately)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: deleted, error } = await sb
    .from('sessions')
    .delete()
    .lt('expires_at', sevenDaysAgo.toISOString())
    .select('id')

  if (error) {
    console.error('[cleanup-sessions] Failed to clean up sessions:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also clean up revoked sessions older than 7 days
  const { data: revokedDeleted, error: revokedError } = await sb
    .from('sessions')
    .delete()
    .lt('revoked_at', sevenDaysAgo.toISOString())
    .select('id')

  if (revokedError) {
    console.error('[cleanup-sessions] Failed to clean up revoked sessions:', revokedError.message)
    return NextResponse.json({ error: revokedError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    expiredSessionsDeleted: deleted?.length ?? 0,
    revokedSessionsDeleted: revokedDeleted?.length ?? 0,
    message: `Cleaned up expired and revoked sessions older than 7 days`,
  })
}
