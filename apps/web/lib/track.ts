/**
 * Client-side event tracking utility.
 * Sends to both Supabase (internal) and PostHog (analytics).
 * Fire-and-forget: never blocks the UI or throws errors.
 */
import posthog from 'posthog-js'

export function trackEvent(eventType: string, eventData: Record<string, any> = {}) {
  try {
    // Send to internal Supabase events table
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, event_data: eventData }),
    }).catch(() => {})

    // Send to PostHog
    if (typeof window !== 'undefined') {
      posthog.capture(eventType, eventData)
    }
  } catch {
    // never throw from tracking
  }
}
