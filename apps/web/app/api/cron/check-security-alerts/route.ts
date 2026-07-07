// POST /api/cron/check-security-alerts — runs alert rules against recent
// security_events and persists triggered alerts. CRON_SECRET-protected.
//
// Recommended schedule: every 5 minutes (*/5 * * * *)
import { NextRequest, NextResponse } from 'next/server'
import { checkAlertRules, persistAlerts } from '@/lib/security/alerting'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const matches = await checkAlertRules()
    const alerts = await persistAlerts(matches)

    return NextResponse.json({
      rules_checked: 3,
      alerts_triggered: alerts.length,
      alerts: alerts.map((a) => ({
        rule_name: a.rule_name,
        actual_count: a.actual_count,
        threshold: a.threshold,
        id: a.id,
      })),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
