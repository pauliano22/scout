import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiAuthError, requireAdmin, requireUser } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import type { FeatureFlag } from '@scout/shared/types/database'

/**
 * GET /api/feature-flags
 * Returns all feature flags. Any authenticated user can read.
 */
export async function GET() {
  try {
    await requireUser()
    const supabase = createClient()
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('flag_name', { ascending: true })

    if (error) return fail(error.message, 500)
    return ok<FeatureFlag[]>((data ?? []) as FeatureFlag[])
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}

/**
 * POST /api/feature-flags
 * Toggle a feature flag. Admin only.
 * Body: { flag_name: string, enabled?: boolean, rollout_percentage?: number }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()

    const flagName = String(body.flag_name ?? '').trim()
    if (!flagName) return fail('flag_name is required')

    const supabase = createClient()

    // Build update payload — only set what was provided
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled)
    if (body.rollout_percentage !== undefined) {
      const pct = Number(body.rollout_percentage)
      if (isNaN(pct) || pct < 0 || pct > 100) return fail('rollout_percentage must be 0–100')
      updates.rollout_percentage = pct
    }

    const { data, error } = await supabase
      .from('feature_flags')
      .upsert({ flag_name: flagName, ...updates })
      .select('*')
      .single()

    if (error) return fail(error.message, 400)
    return ok<FeatureFlag>(data as FeatureFlag, 200)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}
