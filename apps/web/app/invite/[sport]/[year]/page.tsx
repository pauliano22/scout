import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InviteClient from './InviteClient'

interface InvitePageParams {
  sport: string
  year: string
}

/**
 * Normalise a URL sport slug (e.g. "mens-lacrosse", "hockey", "womens-ice-hockey")
 * into the display format expected in the DB.
 */
function normaliseSportSlug(slug: string): string {
  const clean = slug.trim().toLowerCase()
  const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

  if (clean.startsWith('mens-')) {
    const rest = clean.slice(5)
    return `Men's ${titleCase(rest.replace(/-/g, ' '))}`
  }
  if (clean.startsWith('womens-')) {
    const rest = clean.slice(7)
    return `Women's ${titleCase(rest.replace(/-/g, ' '))}`
  }
  return titleCase(clean.replace(/-/g, ' '))
}

interface CohortData {
  sport: string
  sport_slug: string
  graduation_year: number
  total_count: number
  alumni: { full_name: string | null; company: string | null; role: string | null }[]
}

export default async function InvitePage({ params }: { params: InvitePageParams }) {
  const { sport, year } = params

  // Validate year
  const graduationYear = Number(year)
  if (!Number.isInteger(graduationYear) || graduationYear < 1900 || graduationYear > 2100) {
    notFound()
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
      console.error('[invite-page] count error:', countError)
      throw new Error('Failed to load cohort data')
    }

    // Fetch a few names for display
    const { data: alumni, error: alumniError } = await supabase
      .from('alumni')
      .select('full_name, company, role')
      .ilike('sport', displaySport)
      .eq('graduation_year', graduationYear)
      .order('full_name', { ascending: true })
      .limit(6)

    if (alumniError) {
      console.error('[invite-page] alumni fetch error:', alumniError)
    }

    const cohortData: CohortData = {
      sport: displaySport,
      sport_slug: sport,
      graduation_year: graduationYear,
      total_count: count ?? 0,
      alumni: (alumni ?? []).map((a) => ({
        full_name: a.full_name,
        company: a.company,
        role: a.role,
      })),
    }

    return <InviteClient data={cohortData} />
  } catch (e) {
    console.error('[invite-page] error:', e)
    notFound()
  }
}
