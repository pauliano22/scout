import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Alumni } from '@scout/shared/types/database'
import {
  scoreAlumnus,
  type UserPreferences,
} from '@scout/shared/scoring/recommendationScoring'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
// Cap the in-memory pool we score per request. Matches mobile's Pass-2 cap.
const POOL_CAP = 500

export async function GET(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const search = (searchParams.get('search') || '').slice(0, 100)
  const industry = searchParams.get('industry') || 'All'
  const sport = searchParams.get('sport') || ''
  const location = searchParams.get('location') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10), 100)

  const offset = (page - 1) * limit

  // Build the query for data
  let query = supabase
    .from('alumni')
    .select('id, full_name, company, role, industry, sport, graduation_year, linkedin_url, location, photo_url, avatar_url, prestige_score', { count: 'exact' })
    .eq('is_public', true)

  // Apply search filter
  if (search.trim()) {
    const searchTerm = `%${search.trim()}%`
    query = query.or(
      `full_name.ilike.${searchTerm},company.ilike.${searchTerm},role.ilike.${searchTerm},industry.ilike.${searchTerm}`
    )
  } else {
    // Hide alumni with no career info unless they are being searched by name
    query = query.or('company.not.is.null,role.not.is.null')
  }

  // Apply industry filter
  if (industry && industry !== 'All') {
    query = query.eq('industry', industry)
  }

  // Apply sport filter (case-insensitive)
  if (sport) {
    query = query.ilike('sport', sport)
  }

  // Apply location filter (case-insensitive partial match)
  if (location.trim()) {
    query = query.ilike('location', `%${location.trim()}%`)
  }

  // Whether the request actually expresses a ranking intent. With none of these
  // set, the viewer is browsing the directory — fall back to the cheap SQL sort
  // (completeness signals → recency) and skip the scorer. When any signal is
  // present we hand off ranking to the shared scorer so the order reflects how
  // well each alum matches the search.
  const hasRankingIntent =
    !!search.trim() || (industry && industry !== 'All') || !!sport || !!location.trim()

  if (!hasRankingIntent) {
    // Cheap path: SQL-level sort + pagination, identical to the unscored grid.
    query = query
      .order('avatar_url', { ascending: false, nullsFirst: false })
      .order('role', { ascending: false, nullsFirst: false })
      .order('company', { ascending: false, nullsFirst: false })
      .order('graduation_year', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: alumni, error, count } = await query
    if (error) {
      console.error('Alumni search error:', error)
      return NextResponse.json({ error: 'Failed to search alumni' }, { status: 500 })
    }
    const total = count || 0
    return NextResponse.json({
      alumni: alumni || [],
      total,
      page,
      hasMore: offset + limit < total,
    })
  }

  // Ranking path: pull the matching pool (capped), score every row against
  // preferences built from the query, sort by score, then JS-paginate. Returns
  // the same response shape — only the order changes.
  const { data: rows, error, count } = await query.limit(POOL_CAP)

  if (error) {
    console.error('Alumni search error:', error)
    return NextResponse.json({ error: 'Failed to search alumni' }, { status: 500 })
  }

  const prefs: UserPreferences = {
    industries: industry && industry !== 'All' ? [industry] : [],
    sports: sport ? [sport] : [],
    locations: location.trim() ? [location.trim()] : [],
    // Use free-text search as a role keyword — the scorer's generic-token guard
    // already drops bare seniority words ("Director", "Manager", …) so this
    // can't over-match across fields.
    roles: search.trim() ? [search.trim()] : [],
    companies: [],
    priorities: { sameSport: true, similarIndustry: true, seniorAlumni: false },
  }

  const scored = (rows ?? []).map((r) => ({
    row: r,
    // scoreAlumnus reads through normalizeAlumniProfile which tolerates the
    // fields we don't select (work_history, bio, education, …). Cast keeps the
    // type system happy without inventing fake values.
    score: scoreAlumnus(r as unknown as Alumni, prefs, {}).score,
  }))

  scored.sort((a, b) => b.score - a.score)

  const total = count ?? scored.length
  const pageAlumni = scored.slice(offset, offset + limit).map((s) => s.row)

  return NextResponse.json({
    alumni: pageAlumni,
    total,
    page,
    hasMore: offset + limit < total,
  })
}
