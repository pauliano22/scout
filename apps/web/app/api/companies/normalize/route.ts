import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { normalizeCompany } from '@/lib/companies'

/**
 * POST /api/companies/normalize
 *
 * Admin-only endpoint that normalizes company names across all tables
 * (profiles, alumni, opportunities) using the canonical company name
 * list and fuzzy matching.
 *
 * Query params:
 *   ?dry-run=true   — report what would change (default)
 *   ?dry-run=false  — apply changes to the database
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const { searchParams } = new URL(request.url)
    const isDryRun = searchParams.get('dry-run') !== 'false'

    const changes: Array<{
      table: string
      id: string
      field: string
      oldValue: string | null
      newValue: string | null
      industry: string | null
    }> = []

    // ---- Profiles ----
    const { data: profiles, error: err1 } = await db
      .from('profiles')
      .select('id, company, industry')
      .not('company', 'is', null)
      .neq('company', '')

    if (err1) {
      return fail(`Failed to fetch profiles: ${err1.message}`, 500)
    }

    for (const profile of profiles ?? []) {
      const result = normalizeCompany(profile.company)
      if (result.confidence > 0 && result.industry !== 'Other') {
        const needsUpdate =
          profile.company !== result.canonicalName ||
          (profile.industry !== result.industry && profile.industry !== result.industry)

        if (needsUpdate) {
          changes.push({
            table: 'profiles',
            id: profile.id,
            field: 'company',
            oldValue: profile.company,
            newValue: result.canonicalName,
            industry: result.industry,
          })
        }
      }
    }

    // ---- Alumni ----
    const { data: alumni, error: err2 } = await db
      .from('alumni')
      .select('id, company, industry')
      .not('company', 'is', null)
      .neq('company', '')

    if (err2) {
      return fail(`Failed to fetch alumni: ${err2.message}`, 500)
    }

    for (const alumnus of alumni ?? []) {
      const result = normalizeCompany(alumnus.company)
      if (result.confidence > 0 && result.industry !== 'Other') {
        const needsUpdate =
          alumnus.company !== result.canonicalName ||
          (alumnus.industry !== result.industry && alumnus.industry !== result.industry)

        if (needsUpdate) {
          changes.push({
            table: 'alumni',
            id: alumnus.id,
            field: 'company',
            oldValue: alumnus.company,
            newValue: result.canonicalName,
            industry: result.industry,
          })
        }
      }
    }

    // ---- Opportunities ----
    const { data: opps, error: err3 } = await db
      .from('opportunities')
      .select('id, company')
      .not('company', 'is', null)
      .neq('company', '')

    if (err3) {
      return fail(`Failed to fetch opportunities: ${err3.message}`, 500)
    }

    for (const opp of opps ?? []) {
      const result = normalizeCompany(opp.company)
      if (result.confidence > 0 && result.industry !== 'Other') {
        if (opp.company !== result.canonicalName) {
          changes.push({
            table: 'opportunities',
            id: opp.id,
            field: 'company',
            oldValue: opp.company,
            newValue: result.canonicalName,
            industry: result.industry,
          })
        }
      }
    }

    // ---- Apply changes ----
    if (!isDryRun && changes.length > 0) {
      let applied = 0
      let errors = 0

      for (const change of changes) {
        const updateData: Record<string, string | null> = { company: change.newValue }
        if (change.industry) {
          updateData.industry = change.industry
        }

        const { error: updateErr } = await db
          .from(change.table as 'profiles' | 'alumni' | 'opportunities')
          .update(updateData)
          .eq('id', change.id)

        if (updateErr) {
          errors++
          console.warn(`  ✗ ${change.table}/${change.id}: ${updateErr.message}`)
        } else {
          applied++
        }
      }

      return ok({
        dryRun: false,
        totalChanges: changes.length,
        applied,
        errors,
        changes: changes.slice(0, 50), // Truncate response to first 50
      })
    }

    return ok({
      dryRun: true,
      totalChanges: changes.length,
      profiles: changes.filter((c) => c.table === 'profiles').length,
      alumni: changes.filter((c) => c.table === 'alumni').length,
      opportunities: changes.filter((c) => c.table === 'opportunities').length,
      changes: changes.slice(0, 50),
    })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
