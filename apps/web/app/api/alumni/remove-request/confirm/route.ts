// GET /api/alumni/remove-request/confirm?token=... — email-ownership
// confirmation for a removal request (link sent by ../route.ts).
//
// On a valid token: re-match the directory by the submitted email / LinkedIn,
// hide every match (is_public = false), and mark the request verified so the
// admin review queue (/admin/removals) knows the requester proved ownership.
// Tokens are single-use (cleared on success) and expire after 72h.
// Redirects to a human-readable landing page either way.

import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/requestAuth'
import { checkRateLimit, getClientIp, rateLimitExceeded } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security/events'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`alumni-remove-confirm:${ip}`, 'public')
  if (!rl.success) return rateLimitExceeded(rl)

  const invalid = new URL('/remove/confirmed?status=invalid', request.url)
  const success = new URL('/remove/confirmed', request.url)

  const token = request.nextUrl.searchParams.get('token')?.trim()
  if (!token) return NextResponse.redirect(invalid)

  const db = serviceClient()

  const { data: req } = await db
    .from('alumni_removal_requests')
    .select('id, submitted_email, submitted_linkedin, verified, verify_token_expires_at')
    .eq('verify_token', token)
    .maybeSingle()

  if (
    !req ||
    req.verified ||
    !req.verify_token_expires_at ||
    new Date(req.verify_token_expires_at as string).getTime() < Date.now()
  ) {
    return NextResponse.redirect(invalid)
  }

  try {
    // Re-match now (state may have changed since the request) and hide.
    const matchedIds = new Set<string>()
    if (req.submitted_email) {
      const { data } = await db.from('alumni').select('id').ilike('email', req.submitted_email as string)
      for (const r of data ?? []) matchedIds.add(r.id as string)
    }
    if (req.submitted_linkedin) {
      const { data } = await db.from('alumni').select('id').ilike('linkedin_url', req.submitted_linkedin as string)
      for (const r of data ?? []) matchedIds.add(r.id as string)
    }

    const ids = [...matchedIds]
    if (ids.length > 0) {
      await db.from('alumni').update({ is_public: false }).in('id', ids)
    }

    await db
      .from('alumni_removal_requests')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        verify_token: null,
        matched: ids.length > 0,
        alumni_id: ids[0] ?? null,
        status: 'actioned',
        actioned_at: new Date().toISOString(),
      })
      .eq('id', req.id)

    logSecurityEvent({
      event_type: 'alumni_removal_request',
      severity: 'info',
      source_ip: ip,
      details: { stage: 'confirmed', matched: ids.length > 0, hidden_count: ids.length },
    })
  } catch (e) {
    console.error('[alumni/remove-request/confirm] failed:', e instanceof Error ? e.message : e)
    return NextResponse.redirect(invalid)
  }

  return NextResponse.redirect(success)
}
