import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const maxDuration = 120

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const cronSecret = request.headers.get('x-cron-secret') || ''
  const expected = process.env.CRON_SECRET

  if (!expected || (authHeader !== `Bearer ${expected}` && cronSecret !== expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  // Get all roster entries for ground-truth counts
  const { data: rosterEntries } = await supabase
    .from('roster_entries')
    .select('sport, graduation_year')
    .not('graduation_year', 'is', null)

  if (!rosterEntries?.length) {
    return NextResponse.json({ error: 'No roster entries found' }, { status: 404 })
  }

  // Count rostered athletes per sport+year
  const rosterCounts = new Map<string, { sport: string; year: number; count: number }>()
  for (const entry of rosterEntries) {
    const key = `${entry.sport}|${entry.graduation_year}`
    const existing = rosterCounts.get(key) || { sport: entry.sport, year: entry.graduation_year, count: 0 }
    existing.count++
    rosterCounts.set(key, existing)
  }

  // Get registered alumni counts per sport+year
  const { data: alumniProfiles } = await supabase
    .from('alumni')
    .select('sport, graduation_year')

  const registeredCounts = new Map<string, number>()
  for (const a of alumniProfiles || []) {
    const key = `${a.sport}|${a.graduation_year}`
    registeredCounts.set(key, (registeredCounts.get(key) || 0) + 1)
  }

  // Build report rows
  const results = []
  for (const [key, roster] of rosterCounts) {
    const registered = registeredCounts.get(key) || 0
    const coveragePct = roster.count > 0 ? Math.round((registered / roster.count) * 10000) / 100 : 0
    const category = coveragePct < 30 ? 'critical' : coveragePct < 60 ? 'growing' : 'healthy'
    
    results.push({
      sport: roster.sport,
      graduation_year: roster.year,
      total_rostered: roster.count,
      total_registered: registered,
      coverage_pct: coveragePct,
      gap_category: category,
    })
  }

  // Batch insert results
  if (results.length > 0) {
    const { error } = await supabase.from('census_reports').insert(results)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const critical = results.filter(r => r.gap_category === 'critical').length
  const growing = results.filter(r => r.gap_category === 'growing').length
  const healthy = results.filter(r => r.gap_category === 'healthy').length

  return NextResponse.json({
    total: results.length,
    critical,
    growing,
    healthy,
    generated_at: new Date().toISOString(),
  })
}
