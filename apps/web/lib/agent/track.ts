// ─────────────────────────────────────────────────────────────────────────────
// Scout Agent — Lightweight Event Tracking
//
// Fire-and-forget. Logs to console in dev and forwards to the shared
// trackEvent pipe (Supabase user_events + PostHog) when running in a browser.
//
// Events:
//   agent_run_started       { goal_id, user_sport }
//   agent_run_completed     { agent_run_id, goal_id, alumni_count }
//   recommendation_clicked  { agent_run_id, goal_id, alumni_id }
//   draft_viewed            { agent_run_id, goal_id, alumni_id, draft_id }
//   draft_approved          { agent_run_id, goal_id, alumni_id, draft_id }
//   draft_skipped           { agent_run_id, goal_id, alumni_id, draft_id }
//   followup_scheduled      { agent_run_id, goal_id, alumni_id, due_date }
// ─────────────────────────────────────────────────────────────────────────────

import { trackEvent } from '@/lib/track'

interface AgentEvent {
  event: string
  properties: Record<string, unknown>
  ts: string
}

// In-memory log — survives the session, available for inspection / future flush
const _log: AgentEvent[] = []

export function agentTrack(
  event: string,
  properties: Record<string, unknown> = {},
): void {
  const entry: AgentEvent = {
    event,
    properties,
    ts: new Date().toISOString(),
  }
  _log.push(entry)

  // Persist through the shared pipe (user_events + PostHog). Browser-only:
  // trackEvent posts to a relative URL and captures via posthog-js.
  if (typeof window !== 'undefined') {
    trackEvent(event, properties)
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[Scout Agent] ${event}`, properties)
  }
}

/** Return a copy of all events recorded this session. */
export function getAgentEventLog(): AgentEvent[] {
  return [..._log]
}
