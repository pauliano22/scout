// GET /api/cron/verify-graduation-years — Vercel cron endpoint that
// cross-references all alumni self-reported graduation_years against
// the roster_entries table and flags mismatches.
//
// Protected by CRON_SECRET (sent as `authorization: Bearer ***` or
// `x-cron-secret` header).
//
// Response shape:
//   { total: number, verified: number, mismatches: number, unverified: number, flagged: number }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 1. Fetch all alumni
  const { data: alumniList, error: alumniErr } = await sb
    .from('alumni')
    .select('id, full_name, graduation_year, sport')

  if (alumniErr) {
    console.error('[verify-graduation-years] alumni query failed:', alumniErr.message)
    return NextResponse.json({ error: alumniErr.message }, { status: 500 })
  }

  if (!alumniList || alumniList.length === 0) {
    return NextResponse.json({ total: 0, verified: 0, mismatches: 0, unverified: 0, flagged: 0 })
  }

  // 2. Fetch all roster entries
  const { data: rosterEntries, error: rosterErr } = await sb
    .from('roster_entries')
    .select('full_name, sport, graduation_year')

  if (rosterErr) {
    console.error('[verify-graduation-years] roster query failed:', rosterErr.message)
    return NextResponse.json({ error: rosterErr.message }, { status: 500 })
  }

  // Build a lookup: normalized name + sport -> array of roster graduation years
  const rosterLookup = new Map<string, number[]>()
  for (const entry of rosterEntries ?? []) {
    const key = `${(entry.full_name ?? '').toLowerCase().trim()}|${(entry.sport ?? '').toLowerCase().trim()}`
    const years = rosterLookup.get(key) ?? []
    if (entry.graduation_year != null) {
      years.push(entry.graduation_year)
    }
    rosterLookup.set(key, years)
  }

  let verified = 0
  let mismatches = 0
  let unverified = 0
  let flagged = 0
  const now = new Date().toISOString()

  for (const alum of alumniList ?? []) {
    const key = `${(alum.full_name ?? '').toLowerCase().trim()}|${(alum.sport ?? '').toLowerCase().trim()}`
    const rosterYears = rosterLookup.get(key) ?? []
    const reportedYear = alum.graduation_year

    let matchStatus: string
    let rosterYear: number | null = null

    if (rosterYears.length === 0) {
      // No roster entry found for this person/sport combo
      matchStatus = 'unverified'
    } else if (rosterYears.includes(reportedYear)) {
      // Exact match
      matchStatus = 'verified'
      rosterYear = reportedYear
    } else {
      // Mismatch — use the closest roster year
      matchStatus = 'mismatch'
      rosterYear = rosterYears.reduce((closest, y) =>
        Math.abs(y - reportedYear) < Math.abs(closest - reportedYear) ? y : closest,
      )
    }

    const isMismatch = matchStatus === 'mismatch'

    // Upsert: insert or update graduation_verification row
    const { error: upsertErr } = await sb
      .from('graduation_verification')
      .upsert(
        {
          alumni_id: alum.id,
          reported_year: reportedYear,
          roster_year: rosterYear,
          match_status: matchStatus,
          flagged_at: isMismatch ? now : null,
          // Don't reset reviewed flag on re-checks
        },
        {
          onConflict: 'alumni_id',
          ignoreDuplicates: false,
        },
      )
      .select('id')

    if (upsertErr) {
      console.error(`[verify-graduation-years] upsert failed for alumni ${alum.id}:`, upsertErr.message)
    }

    if (matchStatus === 'verified') verified++
    else if (matchStatus === 'mismatch') {
      mismatches++
      if (isMismatch) flagged++
    } else if (matchStatus === 'unverified') unverified++
  }

  return NextResponse.json({
    total: alumniList.length,
    verified,
    mismatches,
    unverified,
    flagged,
  })
}
