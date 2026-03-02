import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const industry = searchParams.get('industry') || 'All'
  const sport = searchParams.get('sport') || ''
  const location = searchParams.get('location') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10), 100)

  const offset = (page - 1) * limit

  // Build the query for data
  let query = supabase
    .from('alumni')
    .select('id, full_name, company, role, industry, sport, graduation_year, linkedin_url, location, avatar_url', { count: 'exact' })
    .eq('is_public', true)

  // Apply search filter
  if (search.trim()) {
    const searchTerm = `%${search.trim()}%`
    query = query.or(
      `full_name.ilike.${searchTerm},company.ilike.${searchTerm},role.ilike.${searchTerm},industry.ilike.${searchTerm}`
    )
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

  // Sort: alumni with industry info first, then by graduation year
  query = query
    .order('industry', { ascending: false, nullsFirst: false })
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
