// Fire-and-forget security event emitter. Writes to security_events via the
// service role so the alerting cron (/api/cron/check-security-alerts) can see
// them. Never throws and never blocks the caller — a logging failure must not
// fail or slow the request it's observing. Best-effort by design: a write can
// be lost if the serverless instance is frozen right after the response.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

// auth_failure feeds the brute-force rule, so it covers both failed admin
// gates (lib/auth.ts 401/403) and password-reset failures (bad/expired
// token, unknown account) — distinguished by details.gate.
export type SecurityEventType =
  | 'auth_failure'
  | 'rate_limit_hit'          // 429 from lib/rate-limit.ts
  | 'data_export'             // admin report / CSV endpoints
  | 'password_reset_request'  // forgot-password token issued (info audit)
  | 'password_reset_success'  // password actually changed (info audit)
  | 'alumni_removal_request'  // public opt-out endpoint
  | 'admin_user_purge'        // institutional purge (/api/admin/users/purge)
  | 'alumni_hard_delete'      // admin hard delete + suppression (/admin/removals)

export function logSecurityEvent(event: {
  event_type: SecurityEventType
  severity: 'info' | 'warning' | 'critical'
  source_ip?: string | null
  user_id?: string | null
  details?: Record<string, unknown>
}): void {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return

    const db = createServiceClient(url, key, { auth: { persistSession: false } })
    db.from('security_events')
      .insert({
        event_type: event.event_type,
        severity: event.severity,
        source_ip: event.source_ip ?? null,
        user_id: event.user_id ?? null,
        details: event.details ?? {},
      })
      .then(
        ({ error }) => {
          if (error) console.error('[security] event insert failed:', error.message)
        },
        (err: unknown) => {
          console.error('[security] event insert failed:', err instanceof Error ? err.message : err)
        },
      )
  } catch (err) {
    console.error('[security] event emit failed:', err instanceof Error ? err.message : err)
  }
}

/**
 * Client IP from the ambient request headers, for call sites (like lib/auth.ts)
 * that don't receive a Request object. Returns null outside a request scope.
 */
export function currentRequestIp(): string | null {
  try {
    const h = headers()
    return (
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      h.get('x-real-ip') ??
      h.get('cf-connecting-ip') ??
      null
    )
  } catch {
    return null
  }
}
