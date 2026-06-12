// GET /api/campaign/coverage?industry=&city= — corpus-coverage probe for the
// goal-setting step. Answers "can the corpus actually serve this slice?" BEFORE
// the student commits a goal, so a thin slice (e.g. Media/LA, or fintech-only)
// is surfaced up front with a broaden suggestion — instead of the loop silently
// abstaining later and presenting to the student as "Scout found nothing".
//
// City/region counting uses the SAME locationMatch as the sourcing gate, so the
// number the student sees is the number the agent will actually work with —
// the old ILIKE proxy said "~0 Finance in Northeast" while the corpus had
// hundreds, and disagreed with the gate on metro suburbs.

import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'
import { CORPUS_INDUSTRIES, coverageTier } from '@/lib/campaign/industries'
import { locationMatch } from '@/lib/agent/sourceAlumniGate'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await resolveRequestUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = auth.db

  const { searchParams } = new URL(req.url)
  const industry = (searchParams.get('industry') ?? '').trim()
  const city = (searchParams.get('city') ?? '').trim()
  if (!(CORPUS_INDUSTRIES as readonly string[]).includes(industry)) {
    return NextResponse.json({ error: 'Unknown industry', valid: CORPUS_INDUSTRIES }, { status: 400 })
  }

  const { count: industryCount } = await supabase
    .from('alumni')
    .select('id', { count: 'exact', head: true })
    .eq('industry', industry)

  let cityCount: number | null = null
  if (city) {
    // Industry slices are small (≤ ~900 rows) — pull locations and run the
    // real gate matcher rather than a string proxy that can't see regions.
    const { data: rows } = await supabase
      .from('alumni')
      .select('location')
      .eq('industry', industry)
      .not('location', 'is', null)
      .limit(2000)
    cityCount = (rows ?? []).filter(r => locationMatch(r.location as string, [city])).length
  }

  const effective = city ? (cityCount ?? 0) : (industryCount ?? 0)
  const tier = coverageTier(effective)

  let suggestion: string | null = null
  if (tier !== 'healthy') {
    suggestion = city
      ? `~${effective} ${industry} alumni in ${city}. Broaden to all cities for more reach.`
      : `~${effective} ${industry} alumni — a smaller field. Finance and Technology have the deepest coverage.`
  }

  return NextResponse.json({
    industry,
    city: city || null,
    industryCount: industryCount ?? 0,
    cityCount,
    effective,
    tier, // 'healthy' | 'moderate' | 'thin'
    suggestion,
  })
}
