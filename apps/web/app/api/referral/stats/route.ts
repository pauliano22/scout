import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/referral/stats
 *
 * Returns referral stats for the authenticated user: redemption count,
 * leaderboard position, and total referrers.
 *
 * Response: { redemption_count, leaderboard_position, total_referrers }
 */
export async function GET() {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user's referral link
    const { data: referralLink } = await supabase
      .from('referral_links')
      .select('id, code, redemption_count')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!referralLink) {
      return NextResponse.json({
        redemption_count: 0,
        leaderboard_position: null,
        total_referrers: 0,
        code: null,
      })
    }

    // Get full count from redemptions (more accurate than cached count)
    const { count: redemptionCount, error: countError } = await supabase
      .from('referral_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('referral_link_id', referralLink.id)

    if (countError) {
      console.error('[referral/stats] count error:', countError)
    }

    const actualCount = redemptionCount ?? referralLink.redemption_count

    // Calculate leaderboard position using the helper function
    const { data: leaderboard } = await supabase
      .rpc('get_referral_leaderboard', { limit_count: 1000 })

    let position: number | null = null
    if (leaderboard) {
      const sorted = (leaderboard as Array<{ user_id: string; referral_count: number }>)
        .sort((a, b) => b.referral_count - a.referral_count)

      const idx = sorted.findIndex((entry) => entry.user_id === user.id)
      if (idx !== -1) {
        position = idx + 1
      } else if (actualCount > 0) {
        // User has referrals but not on board (maybe no profile)
        position = sorted.length + 1
      }
    }

    // Get total distinct referrers
    const { count: totalReferrers } = await supabase
      .from('referral_links')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    return NextResponse.json({
      redemption_count: actualCount,
      leaderboard_position: position,
      total_referrers: totalReferrers ?? 0,
      code: referralLink.code,
    })
  } catch (err) {
    console.error('[referral/stats] error:', err)
    return NextResponse.json({ error: 'Failed to get referral stats' }, { status: 500 })
  }
}
