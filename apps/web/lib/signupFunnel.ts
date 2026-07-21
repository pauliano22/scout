// Client-side signup funnel logging (IDEA 31). Fire-and-forget like lib/track.
// A random session id in sessionStorage correlates the steps of one visit —
// it is not an auth artifact and never leaves the analytics pipe.

const STORAGE_KEY = 'scout-signup-session'

export type SignupStep =
  | 'landing'
  | 'form'          // form rendered (fires on mount for ?role= deep links — see metadata.source)
  | 'form_engaged'  // first focus on any field: real engagement, not a pageview
  | 'submit_blocked' // submit attempt rejected pre-'submit'; metadata.reason says why
  | 'submit'
  | 'verify'
  | 'complete'

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    // Storage unavailable (private mode etc.) — still log, just uncorrelated.
    return 'no-storage'
  }
}

export function logSignupStep(step: SignupStep, metadata: Record<string, unknown> = {}): void {
  try {
    fetch('/api/analytics/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, session_id: sessionId(), metadata }),
    }).catch(() => {})
  } catch {
    // never throw from tracking
  }
}
