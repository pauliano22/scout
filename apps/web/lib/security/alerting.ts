import { createClient as createServiceClient } from '@supabase/supabase-js'
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
