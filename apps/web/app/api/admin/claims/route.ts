// GET  /api/admin/claims        — list alumni profile claims awaiting review
// POST /api/admin/claims        — { alumni_id, action: 'approve' | 'reject' }
//
// Auth: requireAdmin() server-side. Approve publishes the row and grants the
// claimant directory access; reject leaves it hidden.

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { sendEmail, isEmailConfigured } from '@/lib/email'
import { welcomeAlumniHtml, welcomeAlumniSubject, welcomeAlumniText } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
    const db = serviceClient()
    const { data, error } = await db
      .from('alumni')
      .select('id, full_name, email, sport, graduation_year, company, role, location, linkedin_url, claimed_by_user_id, claimed_at')
      .eq('claim_review_status', 'pending')
      .order('claimed_at', { ascending: true })

    if (error) return fail(error.message, 500)
    return ok({ claims: data ?? [] })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    let body: { alumni_id?: string; action?: string } = {}
    try {
      body = await request.json()
    } catch {
      return fail('Invalid JSON body', 400)
    }
    const { alumni_id, action } = body
    if (!alumni_id) return fail('Missing alumni_id', 400)
    if (action !== 'approve' && action !== 'reject') return fail('action must be approve or reject', 400)

    // Load the pending row to find the claimant.
    const { data: row, error: loadErr } = await db
      .from('alumni')
      .select('id, full_name, email, claimed_by_user_id, claim_review_status')
      .eq('id', alumni_id)
      .single()
    if (loadErr || !row) return fail('Claim not found', 404)

    if (action === 'approve') {
      // Load the full alumni record for the email
      const { data: alumniRow } = await db
        .from('alumni')
        .select('full_name, email')
        .eq('id', alumni_id)
        .single()

      const { error: upErr } = await db
        .from('alumni')
        .update({ is_public: true, is_verified: true, claim_review_status: 'approved' })
        .eq('id', alumni_id)
      if (upErr) return fail(upErr.message, 500)

      if (row.claimed_by_user_id) {
        await db
          .from('profiles')
          .update({ directory_access: true })
          .eq('id', row.claimed_by_user_id)

        // Send welcome email — best-effort, won't block the response
        if (alumniRow?.email && isEmailConfigured()) {
          const name = alumniRow.full_name?.split(' ')[0] || 'there'
          sendEmail({
            to: alumniRow.email,
            subject: welcomeAlumniSubject(),
            htmlBody: welcomeAlumniHtml({ name }),
            textBody: welcomeAlumniText({ name }),
          }).then(result => {
            if (!result.success) console.error('[claims] Welcome email failed:', result.error)
          })
        }

        return ok({ status: 'approved' })
      }
      // Shouldn't happen (the claim API always links an account), but surface
      // it: the row is published while the claimant still can't browse.
      console.warn(`[admin/claims] approved ${alumni_id} with no claimed_by_user_id; directory access not granted`)
      return ok({ status: 'approved', warning: 'No linked account on this claim, so directory access was not granted.' })
    }

    // reject → keep hidden, mark rejected
    const { error: rjErr } = await db
      .from('alumni')
      .update({ is_public: false, is_verified: false, claim_review_status: 'rejected' })
      .eq('id', alumni_id)
    if (rjErr) return fail(rjErr.message, 500)
    return ok({ status: 'rejected' })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
