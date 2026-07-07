import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/referral/leaderboard
 *
 * Returns the top referrers sorted by referral count.
 *
 * Query params:
 *   limit - number of entries to return (default: 20)
 *
 * Response: { entries: Array<{ user_id, full_name, sport, graduation_year, referral_count }> }
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100)

    const { data: raw, error } = await supabase
      .rpc('get_referral_leaderboard', { limit_count: limit })

    if (error) {
      console.error('[referral/leaderboard] rpc error:', error)
      return NextResponse.json({ error: 'Failed to get leaderboard' }, { status: 500 })
    }

    const entries = (raw as Array<{
      user_id: string
      full_name: string
      sport: string | null
      graduation_year: number | null
      referral_count: number
    }> | null) ?? []

    return NextResponse.json({ entries })
  } catch (err) {
    console.error('[referral/leaderboard] error:', err)
    return NextResponse.json({ error: 'Failed to get leaderboard' }, { status: 500 })
  }
}
