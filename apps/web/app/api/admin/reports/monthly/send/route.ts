// Scheduled entry point for the monthly admin report (DPA §9: monthly usage reports).
// Schedule (vercel.json): "0 13 1 * *" — 08:00 ET on the 1st of each month.
// Vercel cron invokes GET with `Authorization: Bearer ${CRON_SECRET}`; POST is kept
// for manual triggers (admin session or `x-cron-secret` header).
//
// Delivery: Resend (same provider as password reset) to REPORT_RECIPIENTS
// (comma-separated). When REPORT_RECIPIENTS or RESEND_API_KEY is unset we
// log-and-skip so the cron never fails in an unconfigured environment.

import { NextRequest } from 'next/server'
import { ApiAuthError, getAuthContext } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import { buildMonthlyReport, defaultPreviousMonth, reportToCsv, type MonthlyReport } from '@/lib/reports/monthly'

export const dynamic = 'force-dynamic'

type DispatchResult =
  | { channel: 'resend'; id: string | null; recipients: string[] }
  | { channel: 'skipped'; reason: string }

function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}` ||
         request.headers.get('x-cron-secret') === secret
}

async function run(month: string) {
  const report = await buildMonthlyReport(month)
  const dispatched = await dispatchReport(report)
  return ok({ month, dispatched })
}

// Vercel cron calls GET — cron auth only.
export async function GET(request: NextRequest) {
  try {
    if (!isCronRequest(request)) return fail('Unauthorized', 401)
    const month = request.nextUrl.searchParams.get('month') ?? defaultPreviousMonth()
    return await run(month)
  } catch (e) {
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}

// Manual trigger — admin session or cron secret.
export async function POST(request: NextRequest) {
  try {
    if (!isCronRequest(request)) {
      const ctx = await getAuthContext()
      if (!ctx?.isAdmin) return fail('Unauthorized', 401)
    }
    const body = await request.json().catch(() => ({}))
    const month = body.month ?? defaultPreviousMonth()
    return await run(month)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}

function parseRecipients(): string[] {
  return (process.env.REPORT_RECIPIENTS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

async function dispatchReport(report: MonthlyReport): Promise<DispatchResult> {
  const recipients = parseRecipients()
  if (recipients.length === 0) {
    console.log('[reports/monthly/send] REPORT_RECIPIENTS not set — skipping dispatch for', report.month)
    return { channel: 'skipped', reason: 'REPORT_RECIPIENTS not set' }
  }
  if (!process.env.RESEND_API_KEY) {
    console.log('[reports/monthly/send] RESEND_API_KEY not set — skipping dispatch for', report.month)
    return { channel: 'skipped', reason: 'RESEND_API_KEY not set' }
  }

  const csv = reportToCsv(report)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL ?? 'Scout <noreply@scoutcornell.com>',
      to: recipients,
      subject: `Scout monthly report — ${report.month}`,
      html: reportHtml(report),
      attachments: [
        {
          filename: `scout-monthly-${report.month}.csv`,
          content: Buffer.from(csv, 'utf-8').toString('base64'),
        },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Resend API error ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`)
  }

  const payload = await response.json().catch(() => null) as { id?: string } | null
  console.log('[reports/monthly/send] dispatched', report.month, 'to', recipients.length, 'recipient(s)')
  return { channel: 'resend', id: payload?.id ?? null, recipients }
}

function reportHtml(r: MonthlyReport): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scoutcornell.com'
  const csvUrl = `${baseUrl}/api/admin/reports/monthly.csv?month=${r.month}`

  const rows: Array<[string, string | number]> = [
    ['Signups (total)', r.signups.total],
    ...Object.entries(r.signups.by_role).map(([role, n]): [string, number] => [`Signups — ${role}`, n]),
    ['Active alumni profiles', r.active_alumni],
    ['Monthly active users', r.monthly_active_users],
    ['Connections made', r.connections_made],
    ['Profile views (total)', r.profile_views.total],
    ['Profile views — Discover', r.profile_views.discover],
    ['Profile views — Circles', r.profile_views.circles],
    ['Events held', r.events.held],
    ['Event RSVPs', r.events.rsvps],
    ['Opportunities posted', r.opportunities.posted],
    ['Opportunity saves', r.opportunities.saves],
    ['Outreach messages sent', r.outreach.messages_sent],
  ]

  const tr = rows
    .map(([label, value]) =>
      `<tr><td style="padding:6px 16px 6px 0;color:#555;">${label}</td><td style="padding:6px 0;font-weight:600;text-align:right;">${value}</td></tr>`)
    .join('')

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #B31B1B; margin: 0 0 4px;">Scout</h1>
      <h2 style="margin: 0 0 20px;">Monthly usage report — ${r.month}</h2>
      <table style="border-collapse: collapse; width: 100%;">${tr}</table>
      <p style="margin-top: 24px;">The full report is attached as CSV. Admins can also download it from
        <a href="${csvUrl}" style="color: #B31B1B;">the admin report endpoint</a> (sign-in required).</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">Scout — Cornell Student-Athlete Network · <a href="${baseUrl}" style="color: #B31B1B;">${baseUrl.replace(/^https?:\/\//, '')}</a></p>
    </body>
    </html>
  `
}
