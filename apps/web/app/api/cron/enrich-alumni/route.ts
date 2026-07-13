// GET /api/cron/enrich-alumni — incremental alumni enrichment (fill + refresh).
//
// Each run pulls the stalest / most-incomplete alumni that have a LinkedIn URL,
// re-infers role/company via Claude, and writes through the fill/refresh policy,
// stamping enriched_at so the next run moves on to different rows. Bounded per
// run for cost + Vercel time. Protected by CRON_SECRET.
//
// Query: ?limit=100 (max 300), ?dry=1 (preview candidates, no Claude, no writes).
//
// NOTE: not scheduled in vercel.json yet — enable that deliberately once the
// Supabase/Anthropic keys are rotated and you've reviewed a dry run.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { applyEnrichment, type AlumniForEnrichment } from '@/lib/agent/enrichAlumni'
import { enrichmentPriority } from '@/lib/agent/enrichmentPolicy'
import { getSuppressionSets, isSuppressed } from '@/lib/alumni/suppression'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const runLimit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '100') || 100, 1), 300)
  const dryRun = searchParams.get('dry') === '1'

  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Pull a window of the stalest rows that have a LinkedIn URL to infer from,
  // then re-rank "most-incomplete then stalest" and take the top runLimit.
  const { data, error } = await sb
    .from('alumni')
    .select('id, full_name, email, role, company, location, sport, graduation_year, linkedin_url, enriched_at')
    .not('linkedin_url', 'is', null)
    .order('enriched_at', { ascending: true, nullsFirst: true })
    .limit(runLimit * 3)

  if (error) {
    console.error('[cron/enrich-alumni] query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Skip anyone on the do-not-reimport list (hard-deleted via /admin/removals).
  const suppression = await getSuppressionSets(sb)
  const pool = ((data ?? []) as (AlumniForEnrichment & { email?: string | null })[])
    .filter((c) => !isSuppressed(suppression, c))

  const now = Date.now()
  const candidates = pool
    .sort((a, b) => enrichmentPriority(b, now) - enrichmentPriority(a, now))
    .slice(0, runLimit)

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldEnrich: candidates.length,
      sample: candidates.slice(0, 20).map(c => ({
        name: c.full_name, role: c.role, company: c.company, enriched_at: c.enriched_at ?? null,
      })),
    })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 })
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const report = await applyEnrichment(sb, anthropic, candidates, { mode: 'refresh', nowMs: now })

  return NextResponse.json({ success: true, mode: 'refresh', runLimit, ...report })
}
