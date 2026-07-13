// GET /api/mentorship/available — returns alumni with accepting_mentees=true,
// sorted by remaining spots DESC, for student-athletes to discover mentors.

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'
import { sanitizeAlumniForStudent } from '@/lib/privacy/sanitizeAlumni'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Directory gate, mirroring the migration-052 RLS policy on `alumni`: this
  // route reads through the service client (RLS bypass), so enforce the same
  // rule in app code. Cornell students pass on email domain; alumni/admins
  // pass once directory_access is granted (claim accepted / admin review).
  const isCornellStudent = (auth.email ?? '').toLowerCase().endsWith('@cornell.edu')
  if (!isCornellStudent) {
    const { data: profile } = await auth.db
      .from('profiles')
      .select('directory_access, account_role')
      .eq('id', auth.userId)
      .maybeSingle()
    const allowed = profile?.directory_access === true || profile?.account_role === 'admin'
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch alumni who are accepting mentees, ordered by most available spots first.
  const { data: mentorships, error } = await auth.db
    .from('mentorship')
    .select(`
      *,
      alumni:alumni_id (
        id,
        full_name,
        email,
        role,
        company,
        industry,
        location,
        sport,
        graduation_year,
        photo_url,
        bio,
        advice,
        avatar_url,
        headshot_url,
        linkedin_url,
        is_claimed,
        share_email_with_students
      )
    `)
    .eq('accepting_mentees', true)
    .order('spots_filled', { ascending: true })
    .order('capacity', { ascending: false })

  if (error) {
    console.error('[mentorship/available] error:', error)
    return NextResponse.json({ error: 'Failed to fetch available mentors' }, { status: 500 })
  }

  const available = (mentorships || []).map((m: any) => ({
    // Consent gate at egress: this feed is student-facing.
    alumni: m.alumni ? sanitizeAlumniForStudent(m.alumni) : m.alumni,
    mentorship: {
      accepting_mentees: m.accepting_mentees,
      capacity: m.capacity,
      spots_filled: m.spots_filled,
      spots_remaining: m.capacity - m.spots_filled,
    },
  }))

  return NextResponse.json({ available })
}
