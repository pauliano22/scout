// POST /api/agent/backfill-picks — one-time launch backfill: seed picks for
// EVERY student using whatever data exists, so no one lands on an empty home.
// Re-runnable (materializePicks is idempotent; already-seeded users no-op).
// Returns a coverage report: who ended up with zero picks and why, so data
// gaps are visible before launch. CRON_SECRET-gated, like /api/agent/tick.

import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/requestAuth'
import { materializePicks } from '@/lib/agent/dailyPicks'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  const { data: students } = await db
    .from('profiles')
    .select('id, full_name, primary_industry, sport')
    .eq('account_role', 'student')

  const report = {
    students: students?.length ?? 0,
    withPicks: 0,
    zeroPicks: [] as { userId: string; name: string | null; reason: string }[],
    errors: 0,
  }

  for (const s of students ?? []) {
    try {
      const payload = await materializePicks(db, s.id)
      if (payload.picks.length > 0) {
        report.withPicks++
      } else {
        report.zeroPicks.push({
          userId: s.id,
          name: s.full_name ?? null,
          reason: !s.primary_industry && !s.sport
            ? 'no_profile_signal'
            : payload.paused
              ? 'paused'
              : 'no_candidates_matched',
        })
      }
    } catch (e: any) {
      report.errors++
      console.error('[backfill-picks]', s.id, e?.message ?? e)
    }
  }

  return NextResponse.json(report)
}
