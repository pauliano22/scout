import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ApplyPayload {
  sport: string
}

/**
 * POST /api/ambassador/apply
 * Submit an application to become an ambassador for a sport.
 * Creates a bronze-tier, varsity-badge ambassador_profiles row.
 * Admin must approve (flip is_active) before it's publicly visible.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as ApplyPayload
    const sport = body.sport?.trim()

    if (!sport) {
      return NextResponse.json({ error: 'sport is required' }, { status: 400 })
    }

    // Verify the user has an alumni profile for this sport
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_role, sport, alumni_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    if (profile.account_role !== 'alumni') {
      return NextResponse.json(
        { error: 'Only alumni can apply to become ambassadors.' },
        { status: 403 },
      )
    }

    // Check if user already has an ambassador profile for this sport
    const { data: existing } = await supabase
      .from('ambassador_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('sport', sport)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'You already have an ambassador profile for this sport.' },
        { status: 409 },
      )
    }

    const { data: inserted, error } = await supabase
      .from('ambassador_profiles')
      .insert({
        user_id: user.id,
        alumni_id: profile.alumni_id,
        sport,
        tier: 'bronze',
        badge_type: 'varsity',
        is_active: false, // Requires admin approval
        benefits_access: {},
        recruits_count: 0,
        mentorship_hours: 0,
        referrals_count: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Ambassador apply error:', error)
      return NextResponse.json(
        { error: 'Failed to submit ambassador application. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, ambassador: inserted })
  } catch (err: any) {
    console.error('Ambassador apply error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
