// DPA enforcement: alumni contact info (email, linkedin_url, phone) may only
// reach a STUDENT session when the alum has claimed their profile AND opted in
// via share_email_with_students (migration 018 — written by the profile form,
// enforced here). Scraped rows never opted in, so they must never ship contact
// fields to students.
//
// Rollout is gated behind ENFORCE_CONTACT_CONSENT='true' so prod behavior is
// byte-identical until the founder flips the flag. With the flag ON the
// sanitizer fails CLOSED: rows missing the consent fields (e.g. RPC results
// that don't select them) are treated as non-consented.
//
// This is app-layer egress filtering only — clients that query Supabase
// directly can still over-select. The DB-level backstop (view or column
// grants) is the P1 follow-up.

const CONTACT_FIELDS = ['email', 'linkedin_url', 'phone'] as const
const CONSENT_FIELDS = ['is_claimed', 'share_email_with_students'] as const

export function contactConsentEnforced(): boolean {
  return process.env.ENFORCE_CONTACT_CONSENT === 'true'
}

/**
 * Strip contact fields from an alumni row bound for a student session unless
 * the alum explicitly consented (is_claimed === true AND
 * share_email_with_students === true). The consent fields themselves are
 * server-side inputs, not client data — they're stripped from the response
 * either way. Passthrough while ENFORCE_CONTACT_CONSENT !== 'true'.
 */
export function sanitizeAlumniForStudent<T>(row: T): T {
  if (!contactConsentEnforced()) return row
  if (!row || typeof row !== 'object') return row
  const r = row as Record<string, unknown>
  const consented = r.is_claimed === true && r.share_email_with_students === true
  const out: Record<string, unknown> = { ...r }
  if (!consented) {
    for (const f of CONTACT_FIELDS) if (f in out) out[f] = null
  }
  for (const f of CONSENT_FIELDS) delete out[f]
  return out as T
}

export function sanitizeAlumniListForStudent<T>(rows: T[]): T[] {
  if (!contactConsentEnforced()) return rows
  return rows.map((r) => sanitizeAlumniForStudent(r))
}
