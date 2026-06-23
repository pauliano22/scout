/**
 * Profile Data Freshness — detect stale profile fields.
 *
 * A field is considered "stale" if it was last updated (or created) more
 * than STALE_DAYS ago.  Users see a banner nudging them to refresh
 * stale info.
 */

export const STALE_DAYS = 180 // ~6 months

/** Fields on the Alumni row that the user can keep current. */
export const STALE_FIELDS = ['role', 'company', 'industry', 'location', 'bio'] as const

export type StaleField = (typeof STALE_FIELDS)[number]

export interface FreshnessResult {
  /** Names of the fields that are stale. */
  stale: StaleField[]
  /** Days since the *most recently updated* stale field. */
  daysSinceUpdate: number
  /** ISO timestamp for the stalest (oldest) field. */
  oldestTimestamp: string | null
}

/**
 * Given an Alumni row, return which fields are stale and the gap in days.
 * A null/absent field has never been set → not stale (you can't be stale
 * if you've never been filled in).
 */
export function getStaleFields(alumni: {
  role?: string | null
  company?: string | null
  industry?: string | null
  location?: string | null
  bio?: string | null
  created_at: string
  updated_at?: string | null
}): FreshnessResult {
  const now = Date.now()
  const msPerDay = 86_400_000
  const staleCutoff = now - STALE_DAYS * msPerDay

  const stale: StaleField[] = []
  let oldestTimestamp: string | null = null

  for (const field of STALE_FIELDS) {
    const value = alumni[field]
    // Skip null/empty — never set, not stale.
    if (!value) continue

    // updated_at applies to the whole row, so any field was last modified
    // when the row was last updated (or created).
    const ts = alumni.updated_at ?? alumni.created_at
    if (!ts) continue

    const t = new Date(ts).getTime()
    if (t < staleCutoff) {
      stale.push(field)
      if (!oldestTimestamp || t < new Date(oldestTimestamp).getTime()) {
        oldestTimestamp = ts
      }
    }
  }

  const daysSinceUpdate = oldestTimestamp
    ? Math.floor((now - new Date(oldestTimestamp).getTime()) / msPerDay)
    : 0

  return { stale, daysSinceUpdate, oldestTimestamp }
}
