import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notifyTelegram } from '@/lib/notify/telegram'
import { linkedinSlug, findAlumniByLinkedInSlug } from '@/lib/alumni/linkedin'

interface ClaimPayload {
  alumni_id?: string | null
  current_role: string
  current_company: string
  linkedin_url?: string
  city?: string
  sport?: string
  graduation_year?: number | string
  major?: string
  past_experiences?: string
  advice?: string
  profile_photo_url?: string
  share_email_with_students?: boolean
  engagement_intent?: string
}

const ENGAGEMENT_INTENTS = ['seeking_employment', 'here_to_help', 'both'] as const

/**
 * Final write of the alumni claim wizard.
 *
 * Access gating: if the claimant's name matches the Cornell roster (either the
 * specific row they picked, or a unique name match when they didn't), the claim
 * is auto-accepted — published and the account granted directory access. If the
 * name isn't in the roster (or is ambiguous), the profile is saved HIDDEN and
 * queued for admin review (/admin/claims); an admin approves to publish + grant
 * access. This is why we don't just trust the client-supplied alumni_id.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as ClaimPayload

    const currentRole = body.current_role?.trim()
    const currentCompany = body.current_company?.trim()
    if (!currentRole || !currentCompany) {
      return NextResponse.json(
        { error: 'current_role and current_company are required.' },
        { status: 400 },
      )
    }

    const engagementIntent = body.engagement_intent?.trim() || null
    if (engagementIntent && !ENGAGEMENT_INTENTS.includes(engagementIntent as any)) {
      return NextResponse.json(
        { error: 'Invalid engagement_intent.' },
        { status: 400 },
      )
    }

    const gradYear = body.graduation_year
      ? parseInt(String(body.graduation_year), 10)
      : null
    if (gradYear !== null && (isNaN(gradYear) || gradYear < 1960 || gradYear > 2040)) {
      return NextResponse.json(
        { error: 'Please enter a valid graduation year.' },
        { status: 400 },
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, account_role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    if (profile.account_role !== 'alumni') {
      return NextResponse.json(
        { error: 'Only alumni accounts can claim a profile.' },
        { status: 403 },
      )
    }

    const fullName = (profile.full_name || '').trim()
    const email = profile.email || user.email || null

    // Service-role client to write to alumni without RLS friction; the user's
    // identity is already verified via the cookie session above.
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const sport = body.sport?.trim() || null
    if (!sport || !gradYear) {
      return NextResponse.json(
        { error: 'sport and graduation_year are required to publish.' },
        { status: 400 },
      )
    }

    // ── Determine whether this claim matches the roster ──────────────────
    // matched → auto-accept (publish + grant access); otherwise → admin review.
    let alumniId = body.alumni_id?.trim() || null
    let matched = false

    if (alumniId) {
      let { data: existing } = await service
        .from('alumni')
        .select('id, full_name, claimed_by_user_id, is_claimed, is_duplicate, merged_into_id')
        .eq('id', alumniId)
        .single()

      // A stale link can point at a row that was soft-merged away (migration
      // 061) — follow the pointer so the alum claims the canonical record.
      if (existing?.is_duplicate && existing.merged_into_id) {
        alumniId = existing.merged_into_id as string
        ;({ data: existing } = await service
          .from('alumni')
          .select('id, full_name, claimed_by_user_id, is_claimed, is_duplicate, merged_into_id')
          .eq('id', alumniId)
          .single())
      }

      if (!existing) {
        return NextResponse.json({ error: 'Starter profile not found.' }, { status: 404 })
      }
      if (existing.is_claimed && existing.claimed_by_user_id && existing.claimed_by_user_id !== user.id) {
        return NextResponse.json(
          { error: 'This profile has already been claimed by another account.' },
          { status: 409 },
        )
      }
      // Auto-accept only if the account name matches the row being claimed.
      matched = !!fullName &&
        (existing.full_name || '').trim().toLowerCase() === fullName.toLowerCase()
    } else if (fullName.length >= 3) {
      // No row picked: auto-accept only on a UNIQUE roster name match.
      // Exclude soft-merged duplicates (061) — without this, everyone whose
      // duplicate was merged matches two rows and loses the auto-accept.
      const { data: nameMatches } = await service
        .from('alumni')
        .select('id, claimed_by_user_id, is_claimed')
        .ilike('full_name', fullName)
        .eq('is_duplicate', false)

      const claimable = (nameMatches ?? []).filter(
        (r) => !(r.is_claimed && r.claimed_by_user_id && r.claimed_by_user_id !== user.id),
      )
      if (claimable.length === 1) {
        alumniId = claimable[0].id as string
        matched = true
      }
    }

    const publish = matched

    const writeFields = {
      full_name: fullName,
      email,
      sport,
      graduation_year: gradYear,
      role: currentRole,
      company: currentCompany,
      linkedin_url: body.linkedin_url?.trim() || null,
      location: body.city?.trim() || null,
      bio: body.past_experiences?.trim() || null,
      advice: body.advice?.trim() || null,
      photo_url: body.profile_photo_url?.trim() || null,
      share_email_with_students: Boolean(body.share_email_with_students),
      engagement_intent: engagementIntent,
      is_claimed: true,
      claimed_at: new Date().toISOString(),
      claim_source: 'self_signup' as const,
      claimed_by_user_id: user.id,
      profile_reviewed_by_alumni: true,
      is_public: publish,
      is_verified: publish,
      claim_review_status: publish ? 'approved' : 'pending',
      source: 'opt_in' as const,
    }

    if (alumniId) {
      const { error: updateErr } = await service
        .from('alumni')
        .update(writeFields)
        .eq('id', alumniId)
      if (updateErr) throw updateErr
    } else {
      const { data: inserted, error: insertErr } = await service
        .from('alumni')
        .insert(writeFields)
        .select('id')
        .single()
      if (insertErr) throw insertErr
      alumniId = inserted.id
    }

    // If they gave a LinkedIn URL, auto-fill career history from what our
    // directory already has on file for that URL (same lookup as the manual
    // /api/profile/linkedin-import). Fills only an EMPTY work_history, never
    // overwrites, and only from the row itself or an unclaimed row, so it
    // can't copy another member's claimed data. Best-effort.
    const claimLinkedinUrl = body.linkedin_url?.trim()
    if (claimLinkedinUrl && alumniId) {
      try {
        const slug = linkedinSlug(claimLinkedinUrl)
        if (slug) {
          const { data: target } = await service
            .from('alumni')
            .select('work_history, education')
            .eq('id', alumniId)
            .single()
          const targetHistory = Array.isArray(target?.work_history) ? target.work_history : []
          if (targetHistory.length === 0) {
            const sources = await findAlumniByLinkedInSlug(service, slug)
            const source = sources.find(
              (r) =>
                r.id !== alumniId &&
                Array.isArray(r.work_history) &&
                (r.work_history as unknown[]).length > 0 &&
                (!r.claimed_by_user_id || r.claimed_by_user_id === user.id),
            )
            if (source) {
              await service
                .from('alumni')
                .update({
                  work_history: source.work_history,
                  education: target?.education ?? source.education ?? null,
                })
                .eq('id', alumniId)
            }
          }
        }
      } catch (e) {
        console.warn('claim: linkedin auto-fill skipped:', e)
      }
    }

    // Link the row to the profile. directory_access is granted only when the
    // claim is accepted; a pending claim leaves it false (no browsing yet).
    await service
      .from('profiles')
      .update({
        alumni_id: alumniId,
        major: body.major?.trim() || null,
        linkedin_url: body.linkedin_url?.trim() || null,
        sport,
        graduation_year: gradYear,
        company: currentCompany,
        role: currentRole,
        location: body.city?.trim() || null,
        onboarding_completed: true,
        directory_access: publish,
      })
      .eq('id', user.id)

    // Notify an admin (Telegram) about claims needing review. Best-effort.
    // IDs only — no names/emails. Telegram is third-party, non-US infra with
    // no DPA, so PII stays inside the app; details live at /admin/claims.
    if (!publish) {
      await notifyTelegram(
        `🟠 <b>New Scout claim needs review</b>\n` +
        `id: ${alumniId}\n` +
        `Review: https://scoutcornell.com/admin/claims`,
      )
    }

    return NextResponse.json({
      success: true,
      alumni_id: alumniId,
      status: publish ? 'published' : 'pending_review',
    })
  } catch (err: any) {
    console.error('Alumni claim error:', err)
    return NextResponse.json(
      { error: 'Failed to publish profile. Please try again.' },
      { status: 500 },
    )
  }
}
