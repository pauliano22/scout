import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import { buildMonthlyReport, defaultPreviousMonth } from '@/lib/reports/monthly'
import { logSecurityEvent } from '@/lib/security/events'
import { getClientIp } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const month = request.nextUrl.searchParams.get('month') ?? defaultPreviousMonth()
    const report = await buildMonthlyReport(month)
    logSecurityEvent({
      event_type: 'data_export',
      severity: 'info',
      source_ip: getClientIp(request),
      user_id: ctx.userId,
      details: { endpoint: 'admin_reports_monthly', month },
    })
    return ok(report)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
