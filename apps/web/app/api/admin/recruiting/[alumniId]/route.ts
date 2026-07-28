// GET  /api/admin/recruiting/[alumniId] — drawer payload: full row, activity
//      timeline, and match suggestions awaiting a human decision.
// PATCH /api/admin/recruiting/[alumniId] — lazy-create/update the CRM overlay:
//      status, captain flag, notes, IG handle, next action, match confirm/
//      reject/unlink. signed_up/activated are derived and can never be set.

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { checkRateLimit, addRateLimitHeaders, rateLimitExceeded } from '@/lib/rate-limit'
import { loadRecruitingBundle } from '@/lib/recruiting/merge'
import { isMissingTableError, MIGRATION_HINT } from '@/lib/recruiting/errors'
import type { RecruitingProspectStatus } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'

const MANUAL_STATUSES: RecruitingProspectStatus[] = ['untouched', 'targeted', 'reached_out', 'responded', 'not_now']

export async function GET(request: NextRequest, { params }: { params: { alumniId: string } }) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const rl = checkRateLimit(`admin:${ip || 'admin'}`, 'admin')
    if (!rl.success) return rateLimitExceeded(rl)

    const bundle = await loadRecruitingBundle(db)
    const row = bundle.rows.find(r => r.alumni_id === params.alumniId)
    if (!row) return fail('Not a current student-athlete', 404)

    const activities = row.crm ? bundle.activitiesByProspectId.get(row.crm.id) ?? [] : []
    const suggestions = (bundle.suggestions.get(params.alumniId) ?? []).map(s => ({
      profile_id: s.profile.id,
      full_name: s.profile.full_name,
      email: s.profile.email,
      sport: s.profile.sport,
      graduation_year: s.profile.graduation_year,
      reason: s.reason,
    }))

    return addRateLimitHeaders(
      ok({ prospect: row, activities, suggestions, crmReady: bundle.crmReady }),
      rl,
    )
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { alumniId: string } }) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const rl = checkRateLimit(`admin:${ip || 'admin'}`, 'admin')
    if (!rl.success) return rateLimitExceeded(rl)

    let body: {
      status?: string
      is_captain?: boolean
      notes?: string | null
      instagram_handle?: string | null
      contact_email?: string | null
      next_action?: string | null
      next_action_due?: string | null
      confirm_profile_id?: string
      reject_profile_id?: string
      clear_match?: boolean
    } = {}
    try {
      body = await request.json()
    } catch {
      return fail('Invalid JSON body', 400)
    }

    if (body.status !== undefined && !MANUAL_STATUSES.includes(body.status as RecruitingProspectStatus)) {
      return fail(`status must be one of ${MANUAL_STATUSES.join(', ')}`, 400)
    }

    // The CRM overlays the live universe only — never plain alumni rows.
    const { data: alum, error: alumErr } = await db
      .from('alumni')
      .select('id, graduation_year, is_duplicate, is_public')
      .eq('id', params.alumniId)
      .maybeSingle()
    if (alumErr) throw alumErr
    if (!alum || alum.is_duplicate === true || alum.is_public === false) {
      return fail('Not a current student-athlete', 404)
    }

    // Load-or-create the overlay row.
    const { data: existing, error: readErr } = await db
      .from('recruiting_prospects')
      .select('*')
      .eq('alumni_id', params.alumniId)
      .maybeSingle()
    if (readErr) {
      if (isMissingTableError(readErr)) return fail(MIGRATION_HINT, 409)
      throw readErr
    }

    const patch: Record<string, unknown> = { alumni_id: params.alumniId }
    if (body.status !== undefined) patch.status = body.status
    if (body.is_captain !== undefined) patch.is_captain = body.is_captain
    if (body.notes !== undefined) patch.notes = body.notes || null
    if (body.instagram_handle !== undefined) {
      patch.instagram_handle = body.instagram_handle?.replace(/^@/, '').trim() || null
    }
    if (body.contact_email !== undefined) {
      const cleaned = body.contact_email?.trim().toLowerCase() || null
      if (cleaned && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
        return fail('contact_email is not a valid email address', 400)
      }
      patch.contact_email = cleaned
    }
    if (body.next_action !== undefined) patch.next_action = body.next_action || null
    if (body.next_action_due !== undefined) patch.next_action_due = body.next_action_due || null

    if (body.confirm_profile_id) {
      patch.matched_profile_id = body.confirm_profile_id
      patch.matched_at = new Date().toISOString()
    } else if (body.clear_match) {
      patch.matched_profile_id = null
      patch.matched_at = null
    }
    if (body.reject_profile_id) {
      const prev = (existing?.rejected_profile_ids as string[]) ?? []
      if (!prev.includes(body.reject_profile_id)) {
        patch.rejected_profile_ids = [...prev, body.reject_profile_id]
      }
    }

    const { data: prospect, error: upErr } = await db
      .from('recruiting_prospects')
      .upsert(patch, { onConflict: 'alumni_id' })
      .select()
      .single()
    if (upErr) {
      if (isMissingTableError(upErr)) return fail(MIGRATION_HINT, 409)
      throw upErr
    }

    // Confirming a match repairs the product-level link for everyone.
    if (body.confirm_profile_id) {
      await db
        .from('profiles')
        .update({ alumni_id: params.alumniId })
        .eq('id', body.confirm_profile_id)
        .is('alumni_id', null)
    }

    return addRateLimitHeaders(ok({ prospect }), rl)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
