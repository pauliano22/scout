import { NextRequest, NextResponse } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { fail } from '@/lib/api/respond'
import { buildMonthlyReport, defaultPreviousMonth, reportToCsv } from '@/lib/reports/monthly'
import { logSecurityEvent } from '@/lib/security/events'
import { getClientIp } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const month = request.nextUrl.searchParams.get('month') ?? defaultPreviousMonth()
    const report = await buildMonthlyReport(month)
    const csv = reportToCsv(report)
    logSecurityEvent({
      event_type: 'data_export',
      severity: 'info',
      source_ip: getClientIp(request),
      user_id: ctx.userId,
      details: { endpoint: 'admin_reports_monthly_csv', month },
    })
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="scout-monthly-${month}.csv"`,
      },
    })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
