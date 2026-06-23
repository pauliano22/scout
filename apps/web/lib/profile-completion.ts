/**
 * Profile Completion Scoring Utility
 *
 * Scores an alumni profile 0–100 based on field completeness.
 * Used by the ProfileCompletionWidget and the /api/profile/completion endpoint.
 */

export interface ProfileInput {
  photo_url?: string | null
  bio?: string | null
  industry?: string | null
  company?: string | null
  role?: string | null
  location?: string | null
  grad_year?: number | string | null
  linkedin_url?: string | null
  education?: string | Array<unknown> | null
  sport?: string | null
  class_year?: number | string | null
  [key: string]: unknown
}

export interface CompletionResult {
  score: number
  missing: string[]
  total: number
}

const WEIGHTS: Record<string, number> = {
  photo_url: 15,
  bio: 15,
  industry: 15,
  company: 10,
  role: 10,
  location: 10,
  grad_year: 5,
  linkedin_url: 5,
  education: 5,
  sport: 5,
  class_year: 5,
} as const

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((s, w) => s + w, 0) // 100

/** Human-readable label for each field key. */
const LABELS: Record<string, string> = {
  photo_url: 'Profile photo',
  bio: 'Bio / past experience',
  industry: 'Industry',
  company: 'Company',
  role: 'Role / title',
  location: 'Location',
  grad_year: 'Graduation year',
  linkedin_url: 'LinkedIn URL',
  education: 'Education',
  sport: 'Sport',
  class_year: 'Class year',
}

/**
 * Returns true when a field value is considered "present".
 */
function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return false
    if (['null', 'undefined', 'n/a', '-', ''].includes(trimmed.toLowerCase())) return false
    return true
  }
  if (typeof value === 'number') return !isNaN(value) && value > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

/**
 * Calculate a completion score 0–100 for an alumni profile.
 *
 * @param profile - A flat object with keys matching the WEIGHTS map.
 * @returns {CompletionResult} with score, list of missing field labels, and total possible score.
 */
export function calculateCompletionScore(profile: ProfileInput): CompletionResult {
  const missing: string[] = []

  const score = Object.entries(WEIGHTS).reduce((acc, [field, weight]) => {
    const value = profile[field]
    if (isPresent(value)) {
      return acc + weight
    }
    // For education, also check typical sub‑fields.
    if (field === 'education' && Array.isArray(value) && value.length === 0) {
      // Not present
    }
    missing.push(LABELS[field] || field)
    return acc
  }, 0)

  return {
    score,
    missing: [...new Set(missing)], // deduplicate
    total: TOTAL_WEIGHT,
  }
}

/**
 * Color palette based on score ranges.
 */
export function scoreColor(score: number): 'red' | 'yellow' | 'green' {
  if (score < 40) return 'red'
  if (score <= 70) return 'yellow'
  return 'green'
}

export function scoreHexColor(score: number): string {
  const color = scoreColor(score)
  switch (color) {
    case 'red':
      return '#ef4444'
    case 'yellow':
      return '#eab308'
    case 'green':
      return '#22c55e'
  }
}
