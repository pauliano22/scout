// POST /api/cron/welcome-sequence — daily cron to send welcome drip emails.
//
// Protected by the CRON_SECRET header (x-cron-secret or authorization: Bearer).
// Queries profiles whose created_at aligns with day 1, 2, 4, or 7 ago,
// sends the appropriate email, and records the send in welcome_emails.
//
// Recommended Vercel cron schedule: "0 14 * * *" (10 AM ET daily).
//
// Requires migration 033 (welcome_emails table).

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { renderWelcomeEmail } from '@/lib/emails/welcome-sequence'
import { sendEmail } from '@/lib/emails/send'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const BATCH_LIMIT = 100 // max users to process per tick

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (
    req.headers.get('authorization') === `Bearer ${secret}` ||
    req.headers.get('x-cron-secret') === secret
  )
}

/**
 * Build the date range (start-of-day / end-of-day) for "N days ago".
 */
function dayRange(daysAgo: number): { from: string; to: string } {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const from = new Date(d.getTime() - daysAgo * 86_400_000).toISOString()
  const to = new Date(d.getTime() - daysAgo * 86_400_000 + 86_399_999).toISOString()
  return { from, to }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── Which day(s) to send today ──────────────────────────────────────────
  // We check users who signed up 1, 2, 4, or 7 days ago. Each day gets its own
  // email template. Days 3, 5, 6 are rest days in the drip campaign.
  const daysToSend = [1, 2, 4, 7] as const
  const summary: Array<{ day: number; processed: number; errors: number }> = []

  for (const day of daysToSend) {
    const { from, to } = dayRange(day)

    // Find users who signed up in that window AND haven't already received
    // this day's welcome email.
    const { data: users, error: userError } = await sb
      .from('profiles')
      .select('id, email, full_name, sport')
      .gte('created_at', from)
      .lte('created_at', to)
      .limit(BATCH_LIMIT)

    if (userError) {
      console.error(`[welcome-sequence/day${day}] query error:`, userError.message)
      summary.push({ day, processed: 0, errors: 1 })
      continue
    }

    if (!users || users.length === 0) {
      summary.push({ day, processed: 0, errors: 0 })
      continue
    }

    let processed = 0
    let errors = 0

    for (const user of users) {
      // Check if already sent (idempotency guard)
      const { data: existing } = await sb
        .from('welcome_emails')
        .select('id')
        .eq('user_id', user.id)
        .eq('email_day', day)
        .maybeSingle()

      if (existing) {
        // Already sent — skip
        continue
      }

      const name = user.full_name?.trim() || 'there'
      const sport = user.sport?.trim() || null

      try {
        const { subject, html } = renderWelcomeEmail(day, name, sport)

        const result = await sendEmail(user.email, subject, html)

        if (!result.success) {
          console.error(
            `[welcome-sequence/day${day}] send failed for ${user.email}: ${result.error}`,
          )
          errors++
          continue
        }

        // Record the send
        await sb.from('welcome_emails').insert({
          user_id: user.id,
          email_day: day,
        })

        processed++
      } catch (err: any) {
        console.error(`[welcome-sequence/day${day}] unexpected error for ${user.email}:`, err)
        errors++
      }
    }

    summary.push({ day, processed, errors })
  }

  return NextResponse.json({
    ok: true,
    summary,
    timestamp: new Date().toISOString(),
  })
}
