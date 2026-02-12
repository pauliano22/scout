/**
 * Client-side event tracking utility.
 * Fire-and-forget: never blocks the UI or throws errors.
 */
export function trackEvent(eventType: string, eventData: Record<string, any> = {}) {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, event_data: eventData }),
    }).catch(() => {}) // silently ignore failures
  } catch {
    // never throw from tracking
  }
}
