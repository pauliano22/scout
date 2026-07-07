// GET /api/cron/normalize-sports — Vercel cron endpoint that normalizes
// sport name variants across alumni, profiles, and teams tables.
//
// Protected by CRON_SECRET (sent as `authorization: Bearer *** or
// `x-cron-secret` header).

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { normalizeSport } from '@/lib/sports'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret
}

/** Update sport references in a given table for a given column. */
async function normalizeColumn(
  table: string,
  column: string,
  idColumn: string,
): Promise<{ updated: number; unmapped: Map<string, Set<string>> }> {
  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: rows, error } = await sb
    .from(table)
    .select(`${idColumn}, ${column}`)
    .not(column, 'is', null)
    .neq(column, '')

  if (error) {
    console.error(`[normalize-sports] failed to fetch ${table}.${column}: ${error.message}`)
    return { updated: 0, unmapped: new Map() }
  }

  let updated = 0
  const unmapped = new Map<string, Set<string>>()

  for (const raw of (rows ?? []) as unknown as Array<Record<string, unknown>>) {
    const originalValue = String(raw[column] ?? '')
    if (!originalValue) continue

    const result = normalizeSport(originalValue)

    if (result.confidence >= 1.0 && result.canonicalName !== originalValue) {
      const id = String(raw[idColumn] ?? '')
      if (!id) continue
      const { error: updateErr } = await sb
        .from(table)
        .update({ [column]: result.canonicalName })
        .eq(idColumn, id)

      if (updateErr) {
        console.warn(`  ✗ ${table}/${id}: ${updateErr.message}`)
      } else {
        updated++
      }
    } else if (result.confidence < 0.6) {
      const key = originalValue.trim()
      let locations = unmapped.get(key)
      if (!locations) {
        locations = new Set()
        unmapped.set(key, locations)
      }
      locations.add(`${table}.${column}`)
    }
  }

  return { updated, unmapped }
}

function mergeUnmapped(
  target: Map<string, Set<string>>,
  source: Map<string, Set<string>>,
): void {
  for (const [key, locations] of source) {
    let existing = target.get(key)
    if (!existing) {
      existing = new Set()
      target.set(key, existing)
    }
    for (const loc of locations) {
      existing.add(loc)
    }
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  const tableResults: {
    table: string
    column: string
    updated: number
    unmappedCount: number
  }[] = []

  const allUnmapped = new Map<string, Set<string>>()

  // Normalize alumni.sport
  const aResult = await normalizeColumn('alumni', 'sport', 'id')
  tableResults.push({ table: 'alumni', column: 'sport', updated: aResult.updated, unmappedCount: aResult.unmapped.size })
  mergeUnmapped(allUnmapped, aResult.unmapped)

  // Normalize profiles.sport
  const pResult = await normalizeColumn('profiles', 'sport', 'id')
  tableResults.push({ table: 'profiles', column: 'sport', updated: pResult.updated, unmappedCount: pResult.unmapped.size })
  mergeUnmapped(allUnmapped, pResult.unmapped)

  // Normalize teams.sport
  const tResult = await normalizeColumn('teams', 'sport', 'code')
  tableResults.push({ table: 'teams', column: 'sport', updated: tResult.updated, unmappedCount: tResult.unmapped.size })
  mergeUnmapped(allUnmapped, tResult.unmapped)

  const totalUpdated = tableResults.reduce((s, r) => s + r.updated, 0)
  const totalProcessed = tableResults.reduce((s, r) => s + r.updated + r.unmappedCount, 0)

  // Format unmapped for response
  const unmappedList = Array.from(allUnmapped.entries())
    .map(([value, locations]) => ({
      value,
      locations: Array.from(locations),
    }))
    .sort((a, b) => a.value.localeCompare(b.value))

  const elapsed = Date.now() - startTime

  return NextResponse.json({
    processed: totalProcessed,
    updated: totalUpdated,
    unmapped: unmappedList,
    tables: tableResults,
    elapsedMs: elapsed,
  })
}
