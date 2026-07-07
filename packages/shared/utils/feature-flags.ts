/**
 * Lightweight Feature Flag System
 *
 * Usage (server-side):
 *   import { isFeatureEnabled } from '@scout/shared/utils/feature-flags'
 *   if (await isFeatureEnabled('new_jobs_board', supabase, userId)) { ... }
 *
 * Usage (client-side via API):
 *   const res = await fetch('/api/feature-flags')
 *   const { data: flags } = await res.json()
 *   const enabled = flags.find(f => f.flag_name === 'new_jobs_board')?.enabled
 */

// ---------------------------------------------------------------------------
// Known flag names – single source of truth
// ---------------------------------------------------------------------------

export const FEATURE_FLAGS = {
  NEW_JOBS_BOARD: 'new_jobs_board',
  ONBOARDING_PROGRESS_BAR: 'onboarding_progress_bar',
  MENTORSHIP_MATCHING: 'mentorship_matching',
} as const satisfies Record<string, string>

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

// ---------------------------------------------------------------------------
// Server-side check
// ---------------------------------------------------------------------------

export interface FeatureFlagRow {
  flag_name: string
  enabled: boolean
  rollout_percentage: number
}

/**
 * Check whether a feature flag is enabled for an optional user.
 *
 * 1. If the flag doesn't exist in DB → false (safe default).
 * 2. If `enabled = false` → false.
 * 3. If `rollout_percentage < 100` and a `userId` is provided, the user is
 *    bucketed by a hash of (flagName + userId) so the experience is sticky.
 * 4. Otherwise → true.
 */
export async function isFeatureEnabled(
  flagName: FeatureFlagName | string,
  supabase: { from: (table: string) => any },
  userId?: string | null,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('enabled, rollout_percentage')
    .eq('flag_name', flagName)
    .single()

  if (error || !data) return false
  if (!data.enabled) return false

  // Full rollout – everyone gets it
  if (data.rollout_percentage >= 100) return true

  // No user context – fall back to on/off
  if (!userId) return data.enabled

  // Gradual rollout – hash-based sticky bucketing
  const hash = simpleHash(`${flagName}:${userId}`)
  const bucket = hash % 100
  return bucket < data.rollout_percentage
}

// ---------------------------------------------------------------------------
// Simple string hash (djb2)
// ---------------------------------------------------------------------------

function simpleHash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}
