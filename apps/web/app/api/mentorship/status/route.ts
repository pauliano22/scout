// GET  /api/mentorship/status  — returns current mentorship settings for the logged-in alumni
// PATCH /api/mentorship/status  — toggle accepting_mentees + capacity

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'

export const dynamic = 'force-dynamic'

// ─── GET ───────────────────────────────────────────────────────────────
export async function GET() {
  const auth = await resolveRequestUser(new Request('http://localhost'))
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find the alumni_id linked to this user's profile.
  const { data: profile } = await auth.db
    .from('profiles')
    .select('alumni_id')
    .eq('id', auth.userId)
    .single()

  if (!profile?.alumni_id) {
    return NextResponse.json({ settings: null })
  }

  const { data: mentorship } = await auth.db
    .from('mentorship')
    .select('*')
    .eq('alumni_id', profile.alumni_id)
    .maybeSingle()

  return NextResponse.json({
    settings: mentorship
      ? {
          accepting_mentees: mentorship.accepting_mentees,
          capacity: mentorship.capacity,
          spots_filled: mentorship.spots_filled,
          spots_remaining: mentorship.capacity - mentorship.spots_filled,
        }
      : null,
  })
}

// ─── PATCH ─────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { accepting_mentees?: unknown; capacity?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Find the alumni_id linked to this user's profile.
  const { data: profile } = await auth.db
    .from('profiles')
    .select('alumni_id')
    .eq('id', auth.userId)
    .single()

  if (!profile?.alumni_id) {
    return NextResponse.json({ error: 'No alumni profile found' }, { status: 400 })
  }

  const acceptingMentees = typeof body.accepting_mentees === 'boolean'
    ? body.accepting_mentees
    : undefined

  const capacity = typeof body.capacity === 'number'
    ? Math.max(1, Math.min(5, body.capacity))
    : undefined

  if (capacity !== undefined && (capacity < 1 || capacity > 5)) {
    return NextResponse.json({ error: 'Capacity must be between 1 and 5' }, { status: 400 })
  }

  // Upsert — insert if not exists, update if exists.
  const updateData: Record<string, unknown> = {}
  if (acceptingMentees !== undefined) updateData.accepting_mentees = acceptingMentees
  if (capacity !== undefined) updateData.capacity = capacity

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Check if a mentorship row already exists.
  const { data: existing } = await auth.db
    .from('mentorship')
    .select('id')
    .eq('alumni_id', profile.alumni_id)
    .maybeSingle()

  if (existing) {
    await auth.db
      .from('mentorship')
      .update(updateData)
      .eq('id', existing.id)
  } else {
    await auth.db
      .from('mentorship')
      .insert({
        alumni_id: profile.alumni_id,
        accepting_mentees: acceptingMentees ?? false,
        capacity: capacity ?? 1,
        spots_filled: 0,
      })
  }

  return NextResponse.json({ ok: true })
}
