// POST /api/cron/weekly-digest — Weekly Re-Engagement Digest for Dormant Alumni
//
// Protected by CRON_SECRET (sent as `authorization: Bearer *** or
// `x-cron-secret` header).
//
//  1. Queries active users who haven't logged in for 7+ days
//  2. Builds a digest for each using buildDigest()
//  3. Sends via sendEmail helper (console.log fallback for now)
//  4. Records delivery in sent_digests table
//
// Recommended Vercel Cron schedule: "0 14 * * 0" (09:00 ET Sunday)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildDigest } from '@/lib/emails/digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ── Auth ────────────────────────────────────────────────

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (
    req.headers.get('authorization') === `Bearer ${secret}` ||
    req.headers.get('x-cron-secret') === secret
  )
}

// ── Email sender (stub) ─────────────────────────────────

interface SendResult {
  channel: string
  id: string
}

/**
 * sendEmail — sends an email via the configured provider.
 * Currently logs to console as a fallback. Wire Resend / SES / Postmark here.
 *
 * Returns { channel, id } for audit logging.
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  // TODO: integrate a real email provider (Resend, SES, Postmark)
  console.log('[weekly-digest] sending email', {
    to,
    subject,
    htmlLength: html.length,
  })

  // Stub: simulate a successful send with a synthetic ID
  return {
    channel: 'stub',
    id: `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}

// ── Cron handler ────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 1. Find dormant users — profiles with account_role = 'alumni' or 'student'
  //    that haven't been updated in 7+ days. We use profile.updated_at as a
  //    proxy for "last login" since the platform doesn't have a dedicated
  //    last_login_at column yet.
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: dormantUsers, error: queryError } = await sb
    .from('profiles')
    .select('id, email, full_name')
    .lt('updated_at', sevenDaysAgo)
    .in('account_role', ['alumni', 'student'])
    .order('updated_at', { ascending: true })

  if (queryError) {
    console.error('[weekly-digest] query error:', queryError.message)
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  // 2. Exclude users who already received a digest in the last 7 days
  const eligibleUsers = []
  for (const user of dormantUsers ?? []) {
    const { data: recentDigest } = await sb
      .from('sent_digests')
      .select('id')
      .eq('user_id', user.id)
      .eq('digest_type', 'weekly_reengagement')
      .gte('sent_at', sevenDaysAgo)
      .limit(1)
      .maybeSingle()

    if (!recentDigest) {
      eligibleUsers.push(user)
    }
  }

  // 3. Build and send digests
  const results: Array<{
    user_id: string
    email: string
    status: 'sent' | 'skipped' | 'error'
    error?: string
    digest_id?: number
  }> = []

  for (const user of eligibleUsers) {
    if (!user.email) {
      results.push({
        user_id: user.id,
        email: '',
        status: 'skipped',
        error: 'no email on profile',
      })
      continue
    }

    try {
      // Build the digest
      const digest = await buildDigest(user.id)

      // Send the email
      await sendEmail(user.email, digest.subject, digest.html)

      // Record in sent_digests table
      const { data: insertResult, error: insertError } = await sb
        .from('sent_digests')
        .insert({
          user_id: user.id,
          digest_type: 'weekly_reengagement',
          subject: digest.subject,
          error: null,
        })
        .select('id')
        .maybeSingle()

      results.push({
        user_id: user.id,
        email: user.email,
        status: 'sent',
        digest_id: insertResult?.id ?? undefined,
        ...(insertError ? { error: `recorded but db insert failed: ${insertError.message}` } : {}),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[weekly-digest] error for user ${user.id}:`, message)

      // Log the failure in sent_digests (best-effort, ignore insert errors)
      try {
        await sb.from('sent_digests').insert({
          user_id: user.id,
          digest_type: 'weekly_reengagement',
          subject: null,
          error: message,
        })
      } catch {
        // best-effort
      }

      results.push({
        user_id: user.id,
        email: user.email,
        status: 'error',
        error: message,
      })
    }
  }

  // 4. Return summary
  const sentCount = results.filter((r) => r.status === 'sent').length
  const errorCount = results.filter((r) => r.status === 'error').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length

  return NextResponse.json({
    total: eligibleUsers.length,
    sent: sentCount,
    errors: errorCount,
    skipped: skippedCount,
    dormantUsersFound: dormantUsers?.length ?? 0,
    results,
  })
}
