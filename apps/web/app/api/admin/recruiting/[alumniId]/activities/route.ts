// POST /api/admin/recruiting/[alumniId]/activities — log an outreach touch.
// Lazy-creates the prospect row, then auto-bumps the manual status FORWARD
// only (outreach → reached_out, any reply outcome → responded); the DB
// trigger stamps first-touch timestamps as the backstop.

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { checkRateLimit, addRateLimitHeaders, rateLimitExceeded } from '@/lib/rate-limit'
import { isMissingTableError, MIGRATION_HINT } from '@/lib/recruiting/errors'
import type { RecruitingActivityKind, RecruitingActivityOutcome } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'

const KINDS: RecruitingActivityKind[] = ['ig_dm', 'in_person', 'teammate_intro', 'captain_intro', 'event', 'other']
const OUTCOMES: RecruitingActivityOutcome[] = ['no_reply', 'replied_positive', 'replied_negative', 'agreed_to_join', 'met']
const REPLY_OUTCOMES: RecruitingActivityOutcome[] = ['replied_positive', 'replied_negative', 'agreed_to_join', 'met']

export async function POST(request: NextRequest, { params }: { params: { alumniId: string } }) {
  try {
    const ctx = await requireAdmin()
    const db = serviceClient()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const rl = checkRateLimit(`admin:${ip || 'admin'}`, 'admin')
    if (!rl.success) return rateLimitExceeded(rl)

    let body: { kind?: string; outcome?: string | null; body?: string | null; occurred_at?: string } = {}
    try {
      body = await request.json()
    } catch {
      return fail('Invalid JSON body', 400)
    }
    if (!KINDS.includes(body.kind as RecruitingActivityKind)) {
      return fail(`kind must be one of ${KINDS.join(', ')}`, 400)
    }
    if (body.outcome != null && !OUTCOMES.includes(body.outcome as RecruitingActivityOutcome)) {
      return fail(`outcome must be one of ${OUTCOMES.join(', ')}`, 400)
    }

    // Lazy-create the prospect overlay (universe membership enforced).
    const { data: alum, error: alumErr } = await db
      .from('alumni')
      .select('id, is_duplicate, is_public')
      .eq('id', params.alumniId)
      .maybeSingle()
    if (alumErr) throw alumErr
    if (!alum || alum.is_duplicate === true || alum.is_public === false) {
      return fail('Not a current student-athlete', 404)
    }

    const { data: prospect, error: upErr } = await db
      .from('recruiting_prospects')
      .upsert({ alumni_id: params.alumniId }, { onConflict: 'alumni_id', ignoreDuplicates: false })
      .select()
      .single()
    if (upErr) {
      if (isMissingTableError(upErr)) return fail(MIGRATION_HINT, 409)
      throw upErr
    }

    const { data: activity, error: actErr } = await db
      .from('recruiting_activities')
      .insert({
        prospect_id: prospect.id,
        kind: body.kind,
        outcome: body.outcome ?? null,
        body: body.body?.trim() || null,
        occurred_at: body.occurred_at ?? new Date().toISOString(),
        created_by: ctx.userId,
      })
      .select()
      .single()
    if (actErr) {
      if (isMissingTableError(actErr)) return fail(MIGRATION_HINT, 409)
      throw actErr
    }

    // Forward-only status bump; never regress a manual stage.
    const order = ['untouched', 'targeted', 'reached_out', 'responded']
    const current = order.indexOf(prospect.status)
    const target = REPLY_OUTCOMES.includes(body.outcome as RecruitingActivityOutcome)
      ? order.indexOf('responded')
      : order.indexOf('reached_out')
    let updated = prospect
    if (current !== -1 && target > current) {
      const { data: bumped } = await db
        .from('recruiting_prospects')
        .update({ status: order[target] })
        .eq('id', prospect.id)
        .select()
        .single()
      if (bumped) updated = bumped
    }

    return addRateLimitHeaders(ok({ prospect: updated, activity }), rl)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
