/**
 * Client-side event tracking utility.
 * Sends to both Supabase (internal) and PostHog (analytics).
 * Fire-and-forget: never blocks the UI or throws errors.
 *
 * posthogOnly: for events whose durable user_events row is inserted
 * server-side in the API route the action already hits — sending the Supabase
 * leg from the client too double-counts them.
 */
import posthog from 'posthog-js'

export function trackEvent(
  eventType: string,
  eventData: Record<string, any> = {},
  opts: { posthogOnly?: boolean } = {},
) {
  try {
    // Send to internal Supabase events table
    if (!opts.posthogOnly) {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, event_data: eventData }),
      }).catch(() => {})
    }

    // Send to PostHog
    if (typeof window !== 'undefined') {
      posthog.capture(eventType, eventData)
    }
  } catch {
    // never throw from tracking
  }
}
