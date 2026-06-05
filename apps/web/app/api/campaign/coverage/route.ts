// GET /api/campaign/coverage?industry=&city= — corpus-coverage probe for the
// goal-setting step. Answers "can the corpus actually serve this slice?" BEFORE
// the student commits a goal, so a thin slice (e.g. Media/LA, or fintech-only)
// is surfaced up front with a broaden suggestion — instead of the loop silently
// abstaining later and presenting to the student as "Scout found nothing".
//
// This is an estimate (industry exact-match + a city ILIKE proxy), deliberately
// conservative — it's a hint, not the gate.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CORPUS_INDUSTRIES, coverageTier } from '@/lib/campaign/industries'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const { count } = await supabase
      .from('alumni')
      .select('id', { count: 'exact', head: true })
      .eq('industry', industry)
      .ilike('location', `%${city}%`)
    cityCount = count ?? 0
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
