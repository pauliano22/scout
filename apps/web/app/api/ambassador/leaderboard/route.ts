import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AmbassadorProfile } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ambassador/leaderboard
 * Returns active ambassadors ranked by recruits_count (descending).
 * Supports optional sport filter.
 *
 * Query params:
 *   - sport (optional): filter by sport
 *   - limit (optional, default 20): max results
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const sport = searchParams.get('sport')?.trim() || null
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      50,
    )

    let query = supabase
      .from('ambassador_profiles')
      .select(`
        *,
        profiles:user_id (full_name, avatar_url, alumni_id)
      `)
      .eq('is_active', true)
      .order('recruits_count', { ascending: false })
      .limit(limit)

    if (sport) {
      query = query.eq('sport', sport)
    }

    const { data: ambassadors, error } = await query

    if (error) {
      console.error('Ambassador leaderboard error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ambassadors: (ambassadors || []) as unknown as AmbassadorProfile[],
      total: ambassadors?.length || 0,
    })
  } catch (err: any) {
    console.error('Ambassador leaderboard error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
