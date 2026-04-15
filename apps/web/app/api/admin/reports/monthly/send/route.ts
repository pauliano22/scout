// Scheduled entry point for the monthly admin report.
// Recommended schedule (Vercel Cron or Supabase scheduled function):
//   cron: "0 13 1 * *"   // 08:00 ET on the 1st of each month
// Auth: requires either an admin session OR a `x-cron-secret` header matching CRON_SECRET.

import { NextRequest } from 'next/server'
import { ApiAuthError, getAuthContext } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import { buildMonthlyReport, defaultPreviousMonth } from '@/lib/reports/monthly'

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const headerSecret = request.headers.get('x-cron-secret')
    const isCron = cronSecret && headerSecret && headerSecret === cronSecret

    if (!isCron) {
      const ctx = await getAuthContext()
      if (!ctx?.isAdmin) return fail('Unauthorized', 401)
    }

    const body = await request.json().catch(() => ({}))
    const month = body.month ?? defaultPreviousMonth()
    const report = await buildMonthlyReport(month)

    // Email dispatch adapter stub. Wire a provider (Resend, SES, Postmark) later.
    // Keeping this a pure function so tests can assert the payload without side effects.
    const dispatched = await dispatchReport(report)

    return ok({ month, dispatched })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}

async function dispatchReport(report: { month: string }) {
  // TODO: integrate email provider. For now, log for audit and return a stub id.
  console.log('[reports/monthly/send] dispatched', report.month)
  return { channel: 'stub', id: `stub-${report.month}` }
}
