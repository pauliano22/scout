import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const alumniId = searchParams.get('alumni_id')
  const industry = searchParams.get('industry') || ''
  const sport = searchParams.get('sport') || ''
  const company = searchParams.get('company') || ''

  if (!alumniId) {
    return NextResponse.json({ error: 'alumni_id required' }, { status: 400 })
  }

  const fields = 'id, full_name, company, role, industry, sport, graduation_year, linkedin_url, location, avatar_url'
  const similar: any[] = []
  const seenIds = new Set([alumniId])

  // 1. Same industry (up to 2)
  if (industry) {
    const { data } = await supabase
      .from('alumni')
      .select(fields)
      .eq('is_public', true)
      .eq('industry', industry)
      .neq('id', alumniId)
      .order('graduation_year', { ascending: false })
      .limit(2)

    for (const a of data || []) {
      if (!seenIds.has(a.id)) {
        similar.push(a)
        seenIds.add(a.id)
      }
    }
  }

  // 2. Same sport (fill up to 4)
  if (similar.length < 4 && sport) {
    const { data } = await supabase
      .from('alumni')
      .select(fields)
      .eq('is_public', true)
      .ilike('sport', sport)
      .neq('id', alumniId)
      .order('graduation_year', { ascending: false })
      .limit(4 - similar.length)

    for (const a of data || []) {
      if (!seenIds.has(a.id)) {
        similar.push(a)
        seenIds.add(a.id)
      }
    }
  }

  // 3. Same company (fill up to 4)
  if (similar.length < 4 && company) {
    const { data } = await supabase
      .from('alumni')
      .select(fields)
      .eq('is_public', true)
      .eq('company', company)
      .neq('id', alumniId)
      .order('graduation_year', { ascending: false })
      .limit(4 - similar.length)

    for (const a of data || []) {
      if (!seenIds.has(a.id)) {
        similar.push(a)
        seenIds.add(a.id)
      }
    }
  }

  return NextResponse.json({ similar: similar.slice(0, 4) })
}
