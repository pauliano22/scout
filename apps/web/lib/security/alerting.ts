import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notifyTelegram } from '@/lib/notify/telegram'
import type { SecurityEvent, SecurityAlert } from '@scout/shared/types/database'

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY!

function db() {
  return createServiceClient(supabaseUrl(), serviceRoleKey(), {
    auth: { persistSession: false },
    global: { fetch: (url: any, init: any) => fetch(url, { ...init, cache: 'no-store' }) },
  })
}

interface RuleMatch {
  rule_name: string
  threshold: number
  actual_count: number
  events: SecurityEvent[]
}

/**
 * Evaluate alert rules against recent security_events.
 * Returns a list of triggered alerts.
 */
export async function checkAlertRules(): Promise<RuleMatch[]> {
  const supabase = db()
  const now = new Date()
  const triggered: RuleMatch[] = []

  // ── Rule 1: Brute-force detection (>10 auth failures in 5 minutes) ──
  {
    const since = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
    const { data: events } = await supabase
      .from('security_events')
      .select('*')
      .eq('event_type', 'auth_failure')
      .gte('created_at', since)

    if (events && events.length > 10) {
      triggered.push({
        rule_name: 'brute_force',
        threshold: 10,
        actual_count: events.length,
        events: events as SecurityEvent[],
      })
    }
  }

  // ── Rule 2: Rate-limit trigger (>100 requests in 1 minute) ──
  {
    const since = new Date(now.getTime() - 1 * 60 * 1000).toISOString()
    const { data: events } = await supabase
      .from('security_events')
      .select('*')
      .eq('event_type', 'rate_limit_hit')
      .gte('created_at', since)

    if (events && events.length > 100) {
      triggered.push({
        rule_name: 'rate_limit_burst',
        threshold: 100,
        actual_count: events.length,
        events: events as SecurityEvent[],
      })
    }
  }

  // ── Rule 3: Anomalous data access (>50 data exports in 1 hour) ──
  {
    const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const { data: events } = await supabase
      .from('security_events')
      .select('*')
      .eq('event_type', 'data_export')
      .gte('created_at', since)

    if (events && events.length > 50) {
      triggered.push({
        rule_name: 'anomalous_data_export',
        threshold: 50,
        actual_count: events.length,
        events: events as SecurityEvent[],
      })
    }
  }

  return triggered
}

/**
 * Persist triggered alerts as security_alert records.
 * Returns the created alert rows.
 */
export async function persistAlerts(matches: RuleMatch[]): Promise<SecurityAlert[]> {
  if (matches.length === 0) return []

  const supabase = db()
  const records = matches.map((m) => ({
    rule_name: m.rule_name,
    threshold: m.threshold,
    actual_count: m.actual_count,
    events: JSON.parse(JSON.stringify(m.events)),
  }))

  const { data, error } = await supabase
    .from('security_alerts')
    .insert(records)
    .select()

  if (error) throw new Error(`Failed to persist alerts: ${error.message}`)
  return (data ?? []) as unknown as SecurityAlert[]
}

/**
 * Telegram-notify alerts that haven't been announced yet, then stamp
 * notified_at (migration 064) so the hourly cron doesn't re-alert.
 * PII-free by design: rule name, counts, and an admin link only —
 * Telegram is third-party infra, details stay in the app.
 * Best-effort: on send failure notified_at stays null and the next run retries.
 * Returns the number of alerts notified.
 */
export async function notifyNewAlerts(): Promise<number> {
  const supabase = db()
  const { data: alerts, error } = await supabase
    .from('security_alerts')
    .select('id, rule_name, threshold, actual_count, created_at')
    .is('notified_at', null)
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) {
    console.error('[security] failed to load unnotified alerts:', error.message)
    return 0
  }
  if (!alerts || alerts.length === 0) return 0

  const lines = alerts.map(
    (a) => `• ${a.rule_name}: ${a.actual_count} events (threshold ${a.threshold})`,
  )
  const sent = await notifyTelegram(
    `🔴 <b>Scout security alert${alerts.length > 1 ? 's' : ''}</b>\n` +
      lines.join('\n') +
      `\nReview: https://scoutcornell.com/api/admin/security?section=alerts`,
  )
  if (!sent) return 0

  const { error: markError } = await supabase
    .from('security_alerts')
    .update({ notified_at: new Date().toISOString() })
    .in('id', alerts.map((a) => a.id))
  if (markError) {
    console.error('[security] failed to mark alerts notified:', markError.message)
  }

  return alerts.length
}
