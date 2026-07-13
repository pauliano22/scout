// POST /api/alumni/remove-request — public alumni opt-out / data removal.
//
// Anyone (no account required) can ask to have their scraped profile removed.
//
// Ownership verification (migration 066): requests that include an email now
// get a confirmation link sent to that address (same token pattern as the
// password-reset flow). The hide happens when the link is clicked — see
// ./confirm/route.ts — so this endpoint can no longer be used to hide
// arbitrary people whose email you can guess.
//
// LinkedIn-only requests keep the original err-toward-privacy behavior (hide
// immediately on a confident match; reversible by an admin) because there is
// no email to verify. Name-only requests are logged as 'pending' for an admin.
//
// Responses are intentionally generic (no enumeration of who is / isn't in
// the directory). Rate-limited per IP. Writes go through the service role.

import { NextRequest } from 'next/server'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { checkRateLimit, getClientIp, rateLimitExceeded } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security/events'

export const dynamic = 'force-dynamic'

const GENERIC_OK =
  'Thanks — if we have a matching profile, it has been hidden from the directory and your request will be reviewed. Removal can take up to a few days to fully propagate.'

const GENERIC_VERIFY =
  'Thanks — we sent a confirmation link to that email address. Click it to confirm your request, and any matching profile will be hidden from the directory.'

const VERIFY_TOKEN_TTL_MS = 72 * 60 * 60 * 1000 // 72 hours

async function sendConfirmationEmail(to: string, token: string): Promise<boolean> {
  const confirmUrl = `https://scoutcornell.com/api/alumni/remove-request/confirm?token=${token}`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Scout <noreply@scoutcornell.com>',
      to,
      subject: 'Confirm your Scout profile removal request',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #B31B1B; margin: 0;">Scout</h1>
          </div>
          <h2 style="color: #333; margin-bottom: 20px;">Confirm your removal request</h2>
          <p>We received a request to remove a profile associated with this email address from the Scout alumni directory. Click the button below to confirm — any matching profile will be hidden right away and the request queued for full deletion review:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}" style="background-color: #B31B1B; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">Confirm removal</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link expires in 72 hours.</p>
          <p style="color: #666; font-size: 14px;">If you didn't make this request, you can safely ignore this email and nothing will change.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Scout - Cornell Student-Athlete Network<br>
            <a href="https://scoutcornell.com" style="color: #B31B1B;">scoutcornell.com</a>
          </p>
        </body>
        </html>
      `,
    }),
  })
  if (!res.ok) console.error('[alumni/remove-request] Resend error:', res.status)
  return res.ok
}

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

  try {
    // ── Email path: verify ownership before hiding anything ────────────
    if (email) {
      const token = crypto.randomUUID()
      // alumni_id is a best-effort match recorded for admin context only;
      // the hide is deferred to the confirm route, which re-matches.
      let matchedId: string | null = null
      const { data: emailMatch } = await db.from('alumni').select('id').ilike('email', email).limit(1)
      if (emailMatch?.[0]) matchedId = emailMatch[0].id as string

      await db.from('alumni_removal_requests').insert({
        alumni_id: matchedId,
        submitted_name: name,
        submitted_email: email,
        submitted_linkedin: linkedin || null,
        reason,
        requester_ip: ip,
        matched: matchedId !== null,
        status: 'pending',
        verify_token: token,
        verify_token_expires_at: new Date(Date.now() + VERIFY_TOKEN_TTL_MS).toISOString(),
      })

      // Send regardless of match so responses can't enumerate the directory.
      await sendConfirmationEmail(email, token)

      logSecurityEvent({
        event_type: 'alumni_removal_request',
        severity: 'info',
        source_ip: ip,
        details: { stage: 'verification_sent', matched: matchedId !== null },
      })
      return ok({ message: GENERIC_VERIFY })
    }

    // ── No email: LinkedIn match hides immediately (no address to verify);
    //    name-only stays pending for admin review. ───────────────────────
    const matchedIds = new Set<string>()
    if (linkedin) {
      const { data } = await db.from('alumni').select('id').ilike('linkedin_url', linkedin)
      for (const r of data ?? []) matchedIds.add(r.id as string)
    }

    const ids = [...matchedIds]
    if (ids.length > 0) {
      await db.from('alumni').update({ is_public: false }).in('id', ids)
    }

    await db.from('alumni_removal_requests').insert({
      alumni_id: ids[0] ?? null,
      submitted_name: name,
      submitted_email: null,
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
