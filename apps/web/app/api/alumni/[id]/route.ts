// GET /api/alumni/[id] — one alumni row, for the profile detail modal on
// surfaces that otherwise run on the pre-baked map dataset (which carries no
// linkedin_url or fresh career fields). Field exposure mirrors
// /api/alumni/search; email is never returned.
//
// Auth: web cookie session OR mobile Bearer token, same as [id]/circle.

import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { db } = auth

  const { data: row, error } = await db
    .from('alumni')
    .select('id, full_name, company, role, industry, sport, graduation_year, linkedin_url, location, photo_url, avatar_url, engagement_intent, display_headline, work_history, is_public, is_duplicate')
    .eq('id', params.id)
    .maybeSingle()

  if (error) {
    console.error('[alumni/id]', error.message)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  // Opted-out and merged-away rows don't exist, as far as callers know.
  if (!row || row.is_public === false || row.is_duplicate === true) {
    return NextResponse.json({ error: 'Unknown alumni id' }, { status: 404 })
  }

  const { is_public: _pub, is_duplicate: _dup, ...alum } = row
  return NextResponse.json({ alumni: alum }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}
