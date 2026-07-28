// POST /api/admin/recruiting/send — founder outreach email to selected
// prospects, from the CRM's hand-collected contact_email only (never the
// scraped alumni.email). Nothing is automatic: every call is an explicit
// admin action, dry_run is the default, and every real send is logged as a
// recruiting activity so the CRM stays the source of truth.
//
// Guardrails, in order: requireAdmin → cap 100 recipients per call →
// email_suppression checked per address → skip prospects without a
// contact_email → 1 send/sec throttle (Gmail API safety) → per-recipient
// results returned, partial failure never aborts the batch.
//
// Body: { alumni_ids: string[], subject: string, body: string, dry_run?: true }
// The body supports {first_name} substitution and always gets the reply-to-
// unsubscribe footer appended (opt-outs land in email_suppression by hand
// until an automated path exists).

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { sendEmail, isEmailConfigured } from '@/lib/email'
import { isMissingTableError, MIGRATION_HINT } from '@/lib/recruiting/errors'
import { logSecurityEvent, currentRequestIp } from '@/lib/security/events'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_RECIPIENTS = 100

const FOOTER = `

—
You're getting this because you're a Cornell student-athlete. If you'd rather
not hear from me, reply "unsubscribe" and I'll take you off the same day.
Scout · Cornell athlete network · scoutcornell.com`

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = serviceClient()

    let body: { alumni_ids?: string[]; subject?: string; body?: string; dry_run?: boolean } = {}
    try {
      body = await request.json()
    } catch {
      return fail('Invalid JSON body', 400)
    }
    const ids = Array.isArray(body.alumni_ids) ? body.alumni_ids.filter(Boolean) : []
    if (!ids.length) return fail('alumni_ids is required', 400)
    if (ids.length > MAX_RECIPIENTS) return fail(`Max ${MAX_RECIPIENTS} recipients per call`, 400)
    if (!body.subject?.trim() || !body.body?.trim()) return fail('subject and body are required', 400)
    const dryRun = body.dry_run !== false

    if (!dryRun && !isEmailConfigured()) return fail('Email sending is not configured (GOOGLE_* env)', 503)

    const [{ data: prospects, error: pErr }, { data: suppressed, error: sErr }] = await Promise.all([
      db
        .from('recruiting_prospects')
        .select('id, alumni_id, contact_email, alumni:alumni_id (full_name)')
        .in('alumni_id', ids),
      db.from('email_suppression').select('email'),
    ])
    if (pErr) {
      if (isMissingTableError(pErr)) return fail(MIGRATION_HINT, 409)
      throw pErr
    }
    if (sErr) {
      if (isMissingTableError(sErr)) return fail('email_suppression table missing — apply migration 071', 409)
      throw sErr
    }
    const suppressedSet = new Set((suppressed ?? []).map(s => (s.email as string).toLowerCase()))

    const byAlumniId = new Map((prospects ?? []).map(p => [p.alumni_id as string, p]))
    const results: { alumni_id: string; email: string | null; status: string }[] = []

    for (const alumniId of ids) {
      const p = byAlumniId.get(alumniId)
      const emailAddr = (p?.contact_email as string | null)?.toLowerCase() ?? null
      if (!p || !emailAddr) {
        results.push({ alumni_id: alumniId, email: null, status: 'skipped_no_email' })
        continue
      }
      if (suppressedSet.has(emailAddr)) {
        results.push({ alumni_id: alumniId, email: emailAddr, status: 'skipped_suppressed' })
        continue
      }
      if (dryRun) {
        results.push({ alumni_id: alumniId, email: emailAddr, status: 'would_send' })
        continue
      }

      const alumRel = p.alumni as { full_name?: string } | { full_name?: string }[] | null
      const fullName = (Array.isArray(alumRel) ? alumRel[0]?.full_name : alumRel?.full_name) ?? ''
      const firstName = fullName.split(/\s+/)[0] || 'there'
      const text = body.body!.replaceAll('{first_name}', firstName) + FOOTER

      const sent = await sendEmail({
        to: emailAddr,
        subject: body.subject!.trim(),
        htmlBody: text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>'),
        textBody: text,
      })

      if (sent.success) {
        await db.from('recruiting_activities').insert({
          prospect_id: p.id,
          kind: 'email',
          body: `Sent: "${body.subject!.trim()}"`,
          created_by: ctx.userId,
        })
        results.push({ alumni_id: alumniId, email: emailAddr, status: 'sent' })
      } else {
        results.push({ alumni_id: alumniId, email: emailAddr, status: `failed: ${sent.error ?? 'unknown'}` })
      }
      await new Promise(r => setTimeout(r, 1000))
    }

    const sentCount = results.filter(r => r.status === 'sent').length
    if (!dryRun) {
      logSecurityEvent({
        event_type: 'data_export',
        severity: 'info',
        source_ip: currentRequestIp(),
        user_id: ctx.userId,
        details: { endpoint: '/api/admin/recruiting/send', requested: ids.length, sent: sentCount },
      })
    }

    return ok({ dry_run: dryRun, requested: ids.length, sent: sentCount, results })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
