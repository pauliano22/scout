// GET /api/cron/check-freshness — Vercel cron endpoint that returns all
// claimed alumni profiles whose editable fields are 6+ months stale.
//
// Protected by CRON_SECRET (sent as `authorization: Bearer <secret>` or
// `x-cron-secret` header).
//
// Response shape:
//   { profiles: Array<{ id: string, full_name: string, stale: string[], daysSinceUpdate: number }> }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStaleFields, STALE_DAYS } from '@/lib/profile-freshness'
import type { Alumni } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

  const { data: alumniList, error } = await sb
    .from('alumni')
    .select('*')
    .eq('is_claimed', true)

  if (error) {
    console.error('[check-freshness] query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const staleProfiles: Array<{
    id: string
    full_name: string
    stale: string[]
    daysSinceUpdate: number
  }> = []

  for (const alum of (alumniList ?? []) as Alumni[]) {
    const { stale, daysSinceUpdate } = getStaleFields(alum)
    if (stale.length > 0) {
      staleProfiles.push({ id: alum.id, full_name: alum.full_name, stale, daysSinceUpdate })
    }
  }

  return NextResponse.json({
    total: staleProfiles.length,
    checked: (alumniList ?? []).length,
    staleCutoffDays: STALE_DAYS,
    profiles: staleProfiles,
  })
}
