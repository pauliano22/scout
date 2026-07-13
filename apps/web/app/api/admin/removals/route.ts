// GET  /api/admin/removals — list alumni removal requests for review
// POST /api/admin/removals — { request_id, action: 'hide' | 'hard_delete' }
//
// Auth: requireAdmin() server-side.
// hide        — is_public = false on the matched row(s); reversible.
// hard_delete — permanently deletes the alumni row(s) AND writes the person's
//               email / LinkedIn to alumni_suppression so imports and the
//               enrichment cron never resurrect them. Blocked with a clear
//               message if a row is claimed by a live account — purge the
//               user first (POST /api/admin/users/purge) so the linked
//               profile isn't silently cascaded away.

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { logSecurityEvent, currentRequestIp } from '@/lib/security/events'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
    const db = serviceClient()
    const { data, error } = await db
      .from('alumni_removal_requests')
      .select(
        'id, alumni_id, submitted_name, submitted_email, submitted_linkedin, reason, matched, status, verified, verified_at, created_at, actioned_at, ' +
        'alumni:alumni_id (id, full_name, email, linkedin_url, is_public, claimed_by_user_id)',
      )
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) return fail(error.message, 500)
    return ok({ requests: data ?? [] })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}

interface TargetAlumni {
  id: string
  full_name: string | null
  email: string | null
  linkedin_url: string | null
  claimed_by_user_id: string | null
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = serviceClient()

    let body: { request_id?: string; action?: string } = {}
    try {
      body = await request.json()
    } catch {
      return fail('Invalid JSON body', 400)
    }
    const { request_id, action } = body
    if (!request_id) return fail('Missing request_id', 400)
    if (action !== 'hide' && action !== 'hard_delete') {
      return fail('action must be hide or hard_delete', 400)
    }

    const { data: req, error: loadErr } = await db
      .from('alumni_removal_requests')
      .select('id, alumni_id, submitted_name, submitted_email, submitted_linkedin')
      .eq('id', request_id)
      .single()
    if (loadErr || !req) return fail('Removal request not found', 404)

    // Resolve target rows: the recorded match plus a re-match on the
    // submitted identifiers (duplicates may exist under both keys).
    const targets = new Map<string, TargetAlumni>()
    const collect = (rows: TargetAlumni[] | null) => {
      for (const r of rows ?? []) targets.set(r.id, r)
    }
    const COLS = 'id, full_name, email, linkedin_url, claimed_by_user_id'
    if (req.alumni_id) {
      const { data } = await db.from('alumni').select(COLS).eq('id', req.alumni_id)
      collect(data as TargetAlumni[] | null)
    }
    if (req.submitted_email) {
      const { data } = await db.from('alumni').select(COLS).ilike('email', req.submitted_email)
      collect(data as TargetAlumni[] | null)
    }
    if (req.submitted_linkedin) {
      const { data } = await db.from('alumni').select(COLS).ilike('linkedin_url', req.submitted_linkedin)
      collect(data as TargetAlumni[] | null)
    }
    const rows = [...targets.values()]

    const markActioned = () =>
      db
        .from('alumni_removal_requests')
        .update({ status: 'actioned', actioned_at: new Date().toISOString(), actioned_by: ctx.userId })
        .eq('id', req.id)

    if (action === 'hide') {
      if (rows.length > 0) {
        const { error } = await db
          .from('alumni')
          .update({ is_public: false })
          .in('id', rows.map((r) => r.id))
        if (error) return fail(error.message, 500)
      }
      await markActioned()
      return ok({ status: 'hidden', affected: rows.length })
    }

    // ── hard_delete ──────────────────────────────────────────────────────
    const claimed = rows.find((r) => r.claimed_by_user_id)
    if (claimed) {
      return fail(
        `"${claimed.full_name ?? claimed.id}" is claimed by a live account (user ${claimed.claimed_by_user_id}). ` +
          'Purge that user first via POST /api/admin/users/purge, then hard delete — deleting now would orphan or cascade their account data silently.',
        409,
      )
    }

    // Suppress the identifiers so imports/enrichment skip this person forever.
    // Prefer the directory row's values, fall back to what was submitted.
    const suppressionRows: { email: string | null; linkedin_url: string | null; full_name: string | null }[] =
      rows.length > 0
        ? rows.map((r) => ({
            email: r.email ?? (req.submitted_email as string | null),
            linkedin_url: r.linkedin_url ?? (req.submitted_linkedin as string | null),
            full_name: r.full_name,
          }))
        : [{
            email: (req.submitted_email as string | null) ?? null,
            linkedin_url: (req.submitted_linkedin as string | null) ?? null,
            full_name: (req.submitted_name as string | null) ?? null,
          }]

    for (const s of suppressionRows) {
      if (!s.email && !s.linkedin_url) continue
      const { error } = await db.from('alumni_suppression').insert({
        email: s.email?.toLowerCase() ?? null,
        linkedin_url: s.linkedin_url,
        full_name: s.full_name,
        reason: 'removal_request',
        source_request_id: req.id,
        created_by: ctx.userId,
      })
      // 23505 = already suppressed; that's fine.
      if (error && error.code !== '23505') return fail(`suppression insert failed: ${error.message}`, 500)
    }
    if (suppressionRows.every((s) => !s.email && !s.linkedin_url)) {
      return fail(
        'Nothing to suppress or delete: the request has no email/LinkedIn and no matched row. Use Hide, or handle manually.',
        400,
      )
    }

    let deleted = 0
    if (rows.length > 0) {
      const { count, error } = await db
        .from('alumni')
        .delete({ count: 'exact' })
        .in('id', rows.map((r) => r.id))
      if (error) return fail(error.message, 500)
      deleted = count ?? 0
    }

    await markActioned()
    logSecurityEvent({
      event_type: 'alumni_hard_delete',
      severity: 'info',
      source_ip: currentRequestIp(),
      user_id: ctx.userId,
      details: { request_id: req.id, deleted, suppressed: suppressionRows.length },
    })
    return ok({ status: 'hard_deleted', deleted, suppressed: suppressionRows.length })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
