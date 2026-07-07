// POST /api/roster/import — upserts roster entries into the roster_entries table.
// Protected by CRON_SECRET (via `authorization: Bearer <secret>` or `x-cron-secret` header).
//
// Body: { entries: RosterEntry[] }
// Returns: { imported: number, skipped: number, errors: string[] }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { RosterEntry } from '@/lib/roster/roster-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { entries?: RosterEntry[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const entries = body.entries
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: 'entries must be a non-empty array' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfigured: missing Supabase credentials' }, { status: 500 })
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    try {
      const { error } = await supabase.from('roster_entries').upsert(
        {
          full_name: entry.full_name,
          sport: entry.sport,
          team_years: entry.team_years ?? null,
          graduation_year: entry.graduation_year ?? null,
          sport_category: entry.sport_category ?? null,
          source: entry.source ?? 'import',
        },
        {
          onConflict: 'full_name, sport, graduation_year',
          ignoreDuplicates: false,
        }
      )

      if (error) {
        errors.push(`[${i}] ${entry.full_name} (${entry.sport}): ${error.message}`)
        skipped++
      } else {
        imported++
      }
    } catch (e: any) {
      errors.push(`[${i}] ${entry.full_name} (${entry.sport}): ${e?.message ?? 'Unknown error'}`)
      skipped++
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    errors: errors.length > 0 ? errors : [],
  })
}
