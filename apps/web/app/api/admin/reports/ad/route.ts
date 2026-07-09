import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { ok, fail } from '@/lib/api/respond'
import { buildAdReport, adReportToCsv } from '@/lib/reports/adReport'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const days = Math.min(365, Math.max(7, parseInt(request.nextUrl.searchParams.get('days') ?? '30')))
    const report = await buildAdReport(days)

    if (request.nextUrl.searchParams.get('format') === 'csv') {
      return new Response(adReportToCsv(report), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="scout-ad-report.csv"',
        },
      })
    }

    return ok(report)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
