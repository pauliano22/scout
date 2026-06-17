import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRedis, buildAlumniSearchCacheKey } from '@/lib/redis'
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

  // -- Redis caching layer --
  const hasRankingIntent =
    !!search.trim() || (industry && industry !== 'All') || !!sport || !!location.trim()

  const cacheKey = buildAlumniSearchCacheKey({
    search: search.trim(),
    industry,
    sport,
    location: location.trim(),
    page,
    limit,
    hasRankingIntent,
  })

  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        return NextResponse.json(parsed)
      }
    } catch (err) {
      // Redis read failure is non-fatal — fall through to DB query
      console.warn('[redis] Cache read failed, falling back to DB:', err instanceof Error ? err.message : err)
    }
  }

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

  if (!hasRankingIntent) {
    // Cheap path: SQL-level sort + pagination, identical to the unscored grid
    // in app/discover/page.tsx. prestige_score MUST lead so the directory
    // shows top-tier (finance, big-name) alumni first — without it, page 2+
    // and filter-clears silently lost the finance-first ordering the SSR
    // first page establishes.
    query = query
      .order('prestige_score', { ascending: false, nullsFirst: false })
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
    const cheapResponse = {
      alumni: alumni || [],
      total,
      page,
      hasMore: offset + limit < total,
    }

    // Store in cache (non-blocking; failure is non-fatal)
    if (redis) {
      redis.setex(cacheKey, 300, JSON.stringify(cheapResponse)).catch((err) =>
        console.warn('[redis] Cache write failed:', err instanceof Error ? err.message : err)
      )
    }

    return NextResponse.json(cheapResponse)
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

  const rankingResponse = {
    alumni: pageAlumni,
    total,
    page,
    hasMore: offset + limit < total,
  }

  // Store in cache (non-blocking; failure is non-fatal)
  if (redis) {
    redis.setex(cacheKey, 300, JSON.stringify(rankingResponse)).catch((err) =>
      console.warn('[redis] Cache write failed:', err instanceof Error ? err.message : err)
    )
  }

  return NextResponse.json(rankingResponse)
}
