// GET /api/mentorship/available — returns alumni with accepting_mentees=true,
// sorted by remaining spots DESC, for student-athletes to discover mentors.

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'
import { sanitizeAlumniForStudent } from '@/lib/privacy/sanitizeAlumni'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await resolveRequestUser(new Request('http://localhost'))
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
