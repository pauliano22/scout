import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import { buildMonthlyReport, defaultPreviousMonth } from '@/lib/reports/monthly'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const month = request.nextUrl.searchParams.get('month') ?? defaultPreviousMonth()
    const report = await buildMonthlyReport(month)
    return ok(report)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
