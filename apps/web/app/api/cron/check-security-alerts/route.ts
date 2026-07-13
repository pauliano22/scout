// GET|POST /api/cron/check-security-alerts — runs alert rules against recent
// security_events, persists triggered alerts, and Telegram-notifies any alert
// not yet announced (dedup via security_alerts.notified_at, migration 064).
// CRON_SECRET-protected. Scheduled hourly in vercel.json (Vercel crons use GET
// with an Authorization: Bearer CRON_SECRET header); POST kept for manual runs.
import { NextRequest, NextResponse } from 'next/server'
import { checkAlertRules, persistAlerts, notifyNewAlerts } from '@/lib/security/alerting'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret
}

async function run() {
  try {
    const matches = await checkAlertRules()
    const alerts = await persistAlerts(matches)
    const notified = await notifyNewAlerts()

    return NextResponse.json({
      rules_checked: 3,
      alerts_triggered: alerts.length,
      alerts_notified: notified,
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

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return run()
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return run()
}
