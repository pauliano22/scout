import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/referral/redeem
 *
 * Processes a referral code redemption. Creates a connection between
 * the redeeming user and the referred alumni, and increments the
 * referrer's redemption count.
 *
 * Body: { code: string, connected_alumni_id?: string }
 * Response: { success: true, referrer_name?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { code?: string; connected_alumni_id?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (!body.code || typeof body.code !== 'string') {
      return NextResponse.json({ error: 'Referral code is required' }, { status: 400 })
    }

    const code = body.code.toUpperCase().trim()

    // Find the referral link
    const { data: referralLink, error: linkError } = await supabase
      .from('referral_links')
      .select('id, user_id')
      .eq('code', code)
      .eq('is_active', true)
      .single()

    if (linkError || !referralLink) {
      return NextResponse.json({ error: 'Invalid or expired referral code' }, { status: 404 })
    }

    // Can't redeem your own code
    if (referralLink.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot redeem your own referral code' }, { status: 400 })
    }

    // Check if this user has already redeemed this code
    const { data: existingRedemption } = await supabase
      .from('referral_redemptions')
      .select('id')
      .eq('referral_link_id', referralLink.id)
      .eq('redeemed_by_user_id', user.id)
      .maybeSingle()

    if (existingRedemption) {
      return NextResponse.json({ error: 'You have already used this referral code' }, { status: 409 })
    }

    // Get the referrer's name for the response
    const { data: referrerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', referralLink.user_id)
      .single()

    // Create the redemption record
    const { error: redemptionError } = await supabase
      .from('referral_redemptions')
      .insert({
        referral_link_id: referralLink.id,
        redeemed_by_user_id: user.id,
        connected_alumni_id: body.connected_alumni_id || null,
      })

    if (redemptionError) {
      console.error('[referral/redeem] redemption error:', redemptionError)
      return NextResponse.json({ error: 'Failed to process referral' }, { status: 500 })
    }

    // Increment the redemption count on the referral link
    await supabase.rpc('increment_referral_count', { link_id: referralLink.id })

    // If a connected alumni ID was provided, create a network connection
    if (body.connected_alumni_id) {
      // Check if connection already exists
      const { data: existingConn } = await supabase
        .from('user_networks')
        .select('id')
        .eq('user_id', user.id)
        .eq('alumni_id', body.connected_alumni_id)
        .maybeSingle()

      if (!existingConn) {
        await supabase
          .from('user_networks')
          .insert({
            user_id: user.id,
            alumni_id: body.connected_alumni_id,
            status: 'interested',
          })
      }
    }

    return NextResponse.json({
      success: true,
      referrer_name: referrerProfile?.full_name || 'Someone',
    })
  } catch (err) {
    console.error('[referral/redeem] error:', err)
    return NextResponse.json({ error: 'Failed to redeem referral code' }, { status: 500 })
  }
}
