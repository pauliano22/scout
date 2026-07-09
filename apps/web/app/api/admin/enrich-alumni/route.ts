// Admin alumni enrichment — manual, whole-corpus pass. Shares the engine with the
// incremental cron (/api/cron/enrich-alumni); this route is the big on-demand run.
//   POST ?key=<ADMIN_API_TOKEN>&mode=cleanup|enrich|both&limit=5000  — run it
//   GET  ?key=<ADMIN_API_TOKEN>&limit=50                              — dry-run preview

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import {
  GARBAGE_VALUES,
  BATCH_SIZE,
  CONFIDENCE_THRESHOLD,
  extractLinkedInSlug,
  enrichWithClaude,
  runCleanup,
  applyEnrichment,
  type AlumniForEnrichment,
} from '@/lib/agent/enrichAlumni'

function authCheck(request: Request): boolean {
  const { searchParams } = new URL(request.url)
  const adminKey = searchParams.get('key')
  const token = process.env.ADMIN_API_TOKEN
  if (!token || token.length < 32) return false
  return adminKey === token
}

const ENRICH_SELECT = 'id, full_name, role, company, location, sport, graduation_year, linkedin_url, enriched_at'

/** POST: cleanup + enrichment (fill mode — only populates empty fields). */
export async function POST(request: Request) {
  if (!authCheck(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') ?? 'both' // 'cleanup' | 'enrich' | 'both'
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 5000

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const report: Record<string, unknown> = {}

  if (mode === 'cleanup' || mode === 'both') {
    report.cleanup = await runCleanup(supabase)
  }

  if (mode === 'enrich' || mode === 'both') {
    const { data: candidates, error } = await supabase
      .from('alumni')
      .select(ENRICH_SELECT)
      .not('linkedin_url', 'is', null)
      .or('role.is.null,company.is.null')
      .limit(limit)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    report.enrichment = await applyEnrichment(supabase, anthropic, (candidates ?? []) as AlumniForEnrichment[], { mode: 'fill' })
  }

  return NextResponse.json({ success: true, ...report })
}

/** GET: dry run — count cleanup/enrichment targets and preview inference on a sample. */
export async function GET(request: Request) {
  if (!authCheck(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const garbageList = [...GARBAGE_VALUES]
  const [{ count: dirtyRoles }, { count: dirtyCompanies }, { count: dirtyLocations }, { count: candidateCount }] = await Promise.all([
    supabase.from('alumni').select('id', { count: 'exact', head: true }).in('role', garbageList),
    supabase.from('alumni').select('id', { count: 'exact', head: true }).in('company', garbageList),
    supabase.from('alumni').select('id', { count: 'exact', head: true }).in('location', garbageList),
    supabase.from('alumni').select('id', { count: 'exact', head: true }).not('linkedin_url', 'is', null).or('role.is.null,company.is.null'),
  ])

  const { data: sample } = await supabase.from('alumni').select(ENRICH_SELECT)
    .not('linkedin_url', 'is', null).or('role.is.null,company.is.null').limit(limit)

  const preview: unknown[] = []
  const rows = (sample ?? []) as AlumniForEnrichment[]
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const results = await enrichWithClaude(anthropic, batch)
    for (const alum of batch) {
      const r = results.get(alum.id)
      preview.push({
        name: alum.full_name, sport: alum.sport, year: alum.graduation_year,
        linkedinSlug: extractLinkedInSlug(alum.linkedin_url),
        currentRole: alum.role, currentCompany: alum.company,
        inferredRole: r?.role ?? null, inferredCompany: r?.company ?? null,
        confidence: r?.confidence ?? 0, reasoning: r?.reasoning ?? '',
        wouldWrite: (r?.confidence ?? 0) >= CONFIDENCE_THRESHOLD,
      })
    }
  }

  return NextResponse.json({
    dryRun: true,
    cleanup: { dirtyRoles: dirtyRoles ?? 0, dirtyCompanies: dirtyCompanies ?? 0, dirtyLocations: dirtyLocations ?? 0 },
    enrichment: {
      totalCandidates: candidateCount ?? 0,
      previewSample: limit,
      wouldWrite: preview.filter((p: any) => p.wouldWrite).length,
      preview,
    },
  })
}
