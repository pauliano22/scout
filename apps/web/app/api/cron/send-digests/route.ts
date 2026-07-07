import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const maxDuration = 120

const SPORTS = [
  'Football', 'Basketball - Men', 'Basketball - Women',
  'Hockey - Men', 'Hockey - Women', 'Lacrosse - Men', 'Lacrosse - Women',
  'Soccer - Men', 'Soccer - Women', 'Baseball', 'Softball',
  'Wrestling', 'Track & Field', 'Cross Country', 'Tennis - Men', 'Tennis - Women',
  'Golf - Men', 'Golf - Women', 'Swimming & Diving - Men', 'Swimming & Diving - Women',
  'Volleyball - Women', 'Gymnastics', 'Polo', 'Fencing', 'Squash',
  'Rowing - Men', 'Rowing - Women', 'Sailing', 'Field Hockey',
]

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

  // Get all users subscribed to weekly digests
  const { data: settings } = await supabase
    .from('digest_settings')
    .select('*')
    .neq('digest_frequency', 'never')
    .not('subscribed_sports', 'eq', '{}')

  if (!settings?.length) {
    return NextResponse.json({ processed: 0, message: 'No digest subscribers found' })
  }

  let totalGenerated = 0
  let totalEntries = 0

  for (const setting of settings) {
    for (const sport of setting.subscribed_sports) {
      // Skip if not a known sport
      if (!SPORTS.includes(sport)) continue

      // Get career updates from this sport's alumni in the past 7 days
      const { data: updates } = await supabase
        .from('activity_log')
        .select(`
          *,
          alumni:alumni_id ( full_name, company, role )
        `)
        .in('action', ['profile_update', 'new_job', 'promotion', 'career_change'])
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50)

      if (!updates?.length) continue

      // Filter updates for this sport's alumni
      const { data: alumniInSport } = await supabase
        .from('alumni')
        .select('id')
        .eq('sport', sport)

      const sportAlumniIds = new Set((alumniInSport || []).map(a => a.id))
      const relevantUpdates = updates.filter(u => sportAlumniIds.has(u.alumni_id))

      if (!relevantUpdates.length) continue

      const entries = relevantUpdates.map(u => ({
        alumni_id: u.alumni_id,
        alumni_name: u.alumni?.full_name || 'Unknown',
        company: u.alumni?.company || null,
        role: u.alumni?.role || null,
        action: u.action,
        timestamp: u.created_at,
      }))

      // Insert into digest queue
      const { error } = await supabase.from('digest_queue').insert({
        user_id: setting.user_id,
        sport,
        entries,
        frequency: setting.digest_frequency,
      })

      if (!error) {
        totalGenerated++
        totalEntries += entries.length
      }
    }

    // Update last_sent_at
    if (totalGenerated > 0) {
      await supabase
        .from('digest_settings')
        .update({ last_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', setting.user_id)
    }
  }

  return NextResponse.json({
    processed: totalGenerated,
    entries: totalEntries,
    subscribers: settings.length,
    generated_at: new Date().toISOString(),
  })
}
