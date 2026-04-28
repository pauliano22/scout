import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

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
}

/**
 * Final write of the alumni claim wizard. User-submitted values are the source
 * of truth and overwrite any existing scraped values on the matched row.
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

    // Service-role client to write to alumni / storage without RLS friction;
    // the user's identity is already verified via the cookie session above.
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
      is_claimed: true,
      claimed_at: new Date().toISOString(),
      claim_source: 'self_signup' as const,
      claimed_by_user_id: user.id,
      profile_reviewed_by_alumni: true,
      is_public: true,
      is_verified: true,
      source: 'opt_in' as const,
    }

    let alumniId = body.alumni_id?.trim() || null

    if (alumniId) {
      // Verify the row exists and is not already claimed by someone else.
      const { data: existing } = await service
        .from('alumni')
        .select('id, claimed_by_user_id, is_claimed')
        .eq('id', alumniId)
        .single()

      if (!existing) {
        return NextResponse.json({ error: 'Starter profile not found.' }, { status: 404 })
      }
      if (existing.is_claimed && existing.claimed_by_user_id && existing.claimed_by_user_id !== user.id) {
        return NextResponse.json(
          { error: 'This profile has already been claimed by another account.' },
          { status: 409 },
        )
      }

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

    // Save major + linkedin_url to profile too, and link the row.
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
      })
      .eq('id', user.id)

    return NextResponse.json({ success: true, alumni_id: alumniId })
  } catch (err: any) {
    console.error('Alumni claim error:', err)
    return NextResponse.json(
      { error: 'Failed to publish profile. Please try again.' },
      { status: 500 },
    )
  }
}
