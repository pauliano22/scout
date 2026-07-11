import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/requestAuth'
import { findAlumniMatch } from '@/lib/alumni/match'

/**
 * Returns a possible "starter" alumni profile for the signed-in user to claim,
 * or `{ match: null }` if no plausible row exists. Read-only — never writes.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const sport: string | undefined = body.sport
    const gradYearRaw = body.graduation_year
    const gradYear = gradYearRaw ? parseInt(String(gradYearRaw), 10) : null

    if (!sport || !gradYear || isNaN(gradYear)) {
      return NextResponse.json(
        { error: 'sport and graduation_year are required' },
        { status: 400 },
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const fullName = (profile?.full_name || '').trim()
    if (!fullName) {
      return NextResponse.json({ match: null })
    }

    // Match + hydrate through the service client: a pre-approval alumni
    // claimant (non-Cornell email, directory_access still false) gets zero
    // alumni rows under migration 052 RLS, which would blank the prefill for
    // exactly the people this wizard exists for. Auth stays cookie-scoped
    // above, and the lookup is pinned to the caller's own profile name.
    const service = serviceClient()
    const matched = await findAlumniMatch(service, {
      full_name: fullName,
      email: profile?.email || user.email || null,
      sport,
      graduation_year: gradYear,
    })

    if (!matched) {
      return NextResponse.json({ match: null })
    }

    // Hydrate the matched row so the claim screen can show "Existing info on Scout".
    const { data: alumni } = await service
      .from('alumni')
      .select(
        'id, full_name, sport, graduation_year, company, role, industry, location, linkedin_url, photo_url, bio, advice, is_claimed',
      )
      .eq('id', matched.id)
      .single()

    if (!alumni) {
      return NextResponse.json({ match: null })
    }

    if (alumni.is_claimed) {
      // Already claimed by someone — don't surface as a starter profile.
      return NextResponse.json({ match: null, already_claimed: true })
    }

    return NextResponse.json({
      match: {
        ...alumni,
        match_strategy: matched.match_strategy,
      },
    })
  } catch (err: any) {
    console.error('Alumni match error:', err)
    return NextResponse.json(
      { error: 'Failed to find a match.' },
      { status: 500 },
    )
  }
}
