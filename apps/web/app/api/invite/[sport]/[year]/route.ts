import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Alumni } from '@scout/shared/types/database'

/**
 * Normalise a URL sport slug (e.g. "mens-lacrosse", "hockey", "womens-ice-hockey")
 * into the display format expected in the DB.
 *
 * Handles:
 *   - "mens-*"   → "Men's *"
 *   - "womens-*" → "Women's *"
 *   - bare slug  → Title Case (e.g. "hockey" → "Hockey")
 */
function normaliseSportSlug(slug: string): string {
  // Remove leading/trailing whitespace and lowercase the slug
  const clean = slug.trim().toLowerCase()

  // Title-case a word (preserving "&" and internal caps like "and")
  const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

  // Check for gendered prefix
  if (clean.startsWith('mens-')) {
    const rest = clean.slice(5)
    return `Men's ${titleCase(rest.replace(/-/g, ' '))}`
  }
  if (clean.startsWith('womens-')) {
    const rest = clean.slice(7)
    return `Women's ${titleCase(rest.replace(/-/g, ' '))}`
  }

  // Bare slug — title-case and replace hyphens with spaces
  return titleCase(clean.replace(/-/g, ' '))
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { sport: string; year: string } },
) {
  const { sport, year } = params

  // Validate year
  const graduationYear = Number(year)
  if (!Number.isInteger(graduationYear) || graduationYear < 1900 || graduationYear > 2100) {
    return NextResponse.json(
      { data: null, error: 'Invalid graduation year' },
      { status: 400 },
    )
  }

  const displaySport = normaliseSportSlug(sport)

  try {
    const supabase = createClient()

    // Count alumni matching sport + year
    const { count, error: countError } = await supabase
      .from('alumni')
      .select('*', { count: 'exact', head: true })
      .ilike('sport', displaySport)
      .eq('graduation_year', graduationYear)

    if (countError) {
      console.error('[invite-api] count error:', countError)
      return NextResponse.json(
        { data: null, error: 'Failed to fetch cohort stats' },
        { status: 500 },
      )
    }

    // Fetch a few names for display (up to 6)
    const { data: alumni, error: alumniError } = await supabase
      .from('alumni')
      .select('full_name, company, role')
      .ilike('sport', displaySport)
      .eq('graduation_year', graduationYear)
      .order('full_name', { ascending: true })
      .limit(6)

    if (alumniError) {
      console.error('[invite-api] alumni fetch error:', alumniError)
    }

    return NextResponse.json({
      data: {
        sport: displaySport,
        sport_slug: sport,
        graduation_year: graduationYear,
        total_count: count ?? 0,
        alumni: (alumni as Pick<Alumni, 'full_name' | 'company' | 'role'>[]) ?? [],
      },
      error: null,
    })
  } catch (e) {
    console.error('[invite-api] unexpected error:', e)
    return NextResponse.json(
      { data: null, error: 'Internal error' },
      { status: 500 },
    )
  }
}
