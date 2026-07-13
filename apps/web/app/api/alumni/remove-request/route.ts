// POST /api/alumni/remove-request — public alumni opt-out / data removal.
//
// Anyone (no account required) can ask to have their scraped profile removed.
// On a confident match (email or LinkedIn URL) we immediately hide the row
// (is_public = false) — erring toward privacy — and log the request for admin
// review. Name-only requests are logged as 'pending' for an admin to action, so
// the endpoint can't be used to hide arbitrary people by guessing names.
//
// Responses are intentionally generic (no enumeration of who is/ isn't in the
// directory). Rate-limited per IP. Writes go through the service role, so no
// public RLS insert policy is needed (see migration 053).
//
// HARDENING TODO: confirm ownership via an emailed link before hiding, and add a
// captcha. Tracked in migration 053's header.

import { NextRequest } from 'next/server'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { checkRateLimit, getClientIp, rateLimitExceeded } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security/events'

export const dynamic = 'force-dynamic'

const GENERIC_OK =
  'Thanks — if we have a matching profile, it has been hidden from the directory and your request will be reviewed. Removal can take up to a few days to fully propagate.'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`alumni-remove:${ip}`, 'public')
  if (!rl.success) return rateLimitExceeded(rl)

  let body: { name?: string; email?: string; linkedin_url?: string; reason?: string } = {}
  try {
    body = await request.json()
  } catch {
    return fail('Invalid JSON body', 400)
  }

  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const linkedin = (body.linkedin_url ?? '').trim()
  const reason = (body.reason ?? '').trim().slice(0, 1000) || null

  if (!name) return fail('Please include the full name on the profile.', 400)

  const db = serviceClient()

  // Find matching rows — only by email or LinkedIn URL (strong signals), never by
  // name alone, so the endpoint can't hide arbitrary people.
  const matchedIds = new Set<string>()
  try {
    if (email) {
      const { data } = await db.from('alumni').select('id').ilike('email', email)
      for (const r of data ?? []) matchedIds.add(r.id as string)
    }
    if (linkedin) {
      const { data } = await db.from('alumni').select('id').ilike('linkedin_url', linkedin)
      for (const r of data ?? []) matchedIds.add(r.id as string)
    }

    const ids = [...matchedIds]
    if (ids.length > 0) {
      // Privacy-safe + reversible: hide the matched rows from the directory.
      await db.from('alumni').update({ is_public: false }).in('id', ids)
    }

    await db.from('alumni_removal_requests').insert({
      alumni_id: ids[0] ?? null,
      submitted_name: name,
      submitted_email: email || null,
      submitted_linkedin: linkedin || null,
      reason,
      requester_ip: ip,
      matched: ids.length > 0,
      status: ids.length > 0 ? 'actioned' : 'pending',
      actioned_at: ids.length > 0 ? new Date().toISOString() : null,
    })

    logSecurityEvent({
      event_type: 'alumni_removal_request',
      severity: 'info',
      source_ip: ip,
      details: { matched: ids.length > 0, hidden_count: ids.length },
    })
  } catch (e) {
    // Don't leak internal errors; the request is best-effort and generic by design.
    console.error('[alumni/remove-request] failed:', e instanceof Error ? e.message : e)
    // Still return the generic OK so the flow doesn't reveal state.
  }

  return ok({ message: GENERIC_OK })
}
