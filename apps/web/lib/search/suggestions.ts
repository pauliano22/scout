// Suggestion cards for the alumni-search landing screen (SearchClient).
//
// Goals: load instantly, never empty/broken, feel fresh rather than identical
// every day. Assembled server-side and passed to the client as exactly four
// strings — the client never fetches and never sees a loading/empty state.
//
// Three sources blended per request:
//   • trending      — facets ≥5 distinct users have searched (cached, cross-user)
//   • personalized  — phrases templated from the user's profile fields
//   • evergreen      — the original static examples (also the universal fallback)
//
// Any failure at any layer falls back to STATIC_FALLBACK, so the cards are
// never empty. Trending is dormant until real traffic accrues facets that
// clear the distinct-user gate (today it returns []).

import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Profile } from '@scout/shared/types/database'

// ── Config ──────────────────────────────────────────────────────────────────
const SLOT_COUNT = 4
// Privacy gate: a trending facet is surfaced only when this many DISTINCT users
// have searched it — never one identifiable person's search.
const MIN_DISTINCT_USERS = 5
const TRENDING_LOOKBACK_DAYS = 30
const TRENDING_TTL_SECONDS = 3600
const TRENDING_MAX = 5

// Evergreen source AND the universal fallback — realistic, student-facing
// searches. Keep in sync with EXAMPLES in app/plan/SearchClient.tsx (the
// client-side fallback used when no dynamic suggestions are passed).
export const STATIC_FALLBACK: readonly string[] = [
  'Alumni in finance in New York',
  'People who work at Google or Amazon',
  'Alumni who went into consulting',
  'Recent grads working in marketing',
]

// ── Public API ────────────────────────────────────────────────────────────--
interface SuggestionInput {
  userId: string
  profile: Profile
  // Cookie-scoped SSR client — used only to check the user's OWN history (RLS
  // permits reading own user_events). Trending uses a separate service client.
  supabase: { from: (t: string) => any }
}

export async function getSearchSuggestions({ userId, profile, supabase }: SuggestionInput): Promise<string[]> {
  try {
    const seed = dailySeed(userId)
    const [trending, hasHistory] = await Promise.all([
      getTrendingPhrases(),
      userHasHistory(supabase, userId),
    ])

    const personalized = rotate(personalizedPhrases(profile), seed)
    const trendingRot = rotate(trending, seed)
    const evergreenRot = rotate([...STATIC_FALLBACK], seed)

    const picks: string[] = []
    if (hasHistory && personalized.length > 0) {
      // Returning user with history: ~2 personalized + 1 trending + 1 evergreen.
      pushUnique(picks, personalized.slice(0, 2))
      pushUnique(picks, trendingRot.slice(0, 1))
      pushUnique(picks, evergreenRot.slice(0, 1))
    } else {
      // New / low-history user: trending across the site + 1 evergreen.
      pushUnique(picks, trendingRot.slice(0, 3))
      pushUnique(picks, evergreenRot.slice(0, 1))
    }

    // Always top up to exactly four from the evergreen fallback.
    pushUnique(picks, evergreenRot)
    return picks.slice(0, SLOT_COUNT)
  } catch {
    // Never let suggestion assembly break the page.
    return [...STATIC_FALLBACK]
  }
}

// ── Trending (cross-user, cached) ─────────────────────────────────────────--
// Cached across all users for TRENDING_TTL_SECONDS — the expensive cross-user
// aggregation runs at most once per hour, not per page load. Uses the
// service-role client because user_events RLS blocks reading other users' rows.
const getTrendingPhrases = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!url || !key) return []
      const admin = createClient(url, key)

      const cutoff = new Date(Date.now() - TRENDING_LOOKBACK_DAYS * 86_400_000).toISOString()
      // Only genuine typed searches that actually returned matches. Rows logged
      // before the source/facets fields existed are naturally excluded (their
      // source is not 'typed'), so trending can't be skewed by chip clicks or
      // legacy events.
      const { data, error } = await admin
        .from('user_events')
        .select('user_id, event_data')
        .eq('event_type', 'alumni_search')
        .eq('event_data->>source', 'typed')
        .eq('event_data->>outcome', 'matches')
        .gte('created_at', cutoff)
        .limit(5000)
      if (error || !data) return []

      // Count DISTINCT users per facet. Group on a lowercased key; keep the
      // first-seen display form for rendering.
      const users = new Map<string, Set<string>>()
      const display = new Map<string, string>()
      for (const row of data as Array<{ user_id: string; event_data: any }>) {
        const facets = row.event_data?.facets
        if (!facets) continue
        for (const phrase of facetsToPhrases(facets)) {
          const k = phrase.toLowerCase()
          if (!users.has(k)) { users.set(k, new Set()); display.set(k, phrase) }
          users.get(k)!.add(row.user_id)
        }
      }

      return [...users.entries()]
        .filter(([, set]) => set.size >= MIN_DISTINCT_USERS)
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, TRENDING_MAX)
        .map(([k]) => display.get(k)!)
    } catch {
      return []
    }
  },
  ['alumni-search-trending'],
  { revalidate: TRENDING_TTL_SECONDS },
)

// Render a logged intent's facets into candidate suggestion phrases. Mirrors
// the ParsedIntent.soft shape: { roles, industries, themes }.
function facetsToPhrases(facets: { roles?: string[]; industries?: string[]; themes?: string[] }): string[] {
  const out: string[] = []
  for (const r of facets.roles ?? []) if (r) out.push(`${r} alumni`)
  for (const i of facets.industries ?? []) if (i) out.push(`Alumni working in ${i}`)
  for (const t of facets.themes ?? []) if (t) out.push(`Alumni who ${t}`)
  return out
}

// ── Personalization (per-user, from profile) ─────────────────────────────--
function personalizedPhrases(profile: Profile): string[] {
  const roles = profile.target_roles ?? []
  const industries = [profile.primary_industry, ...(profile.secondary_industries ?? [])].filter(
    (v): v is string => Boolean(v),
  )
  const locations = profile.preferred_locations ?? []

  const out: string[] = []
  for (const r of roles) out.push(`${r} alumni`)
  for (const i of industries) out.push(`Alumni working in ${i}`)
  if (roles[0] && locations[0]) out.push(`${roles[0]} alumni in ${locations[0]}`)
  else if (industries[0] && locations[0]) out.push(`Alumni in ${industries[0]} based in ${locations[0]}`)
  return dedupe(out)
}

async function userHasHistory(supabase: { from: (t: string) => any }, userId: string): Promise<boolean> {
  try {
    const { count } = await supabase
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'alumni_search')
    return (count ?? 0) > 0
  } catch {
    return false
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────--
// Daily, user-seeded: stable within a day, rotates across days. Deterministic
// so SSR and any re-render agree.
function dailySeed(userId: string): number {
  const day = Math.floor(Date.now() / 86_400_000)
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0
  return Math.abs(day + h)
}

function rotate<T>(arr: T[], offset: number): T[] {
  if (arr.length <= 1) return arr
  const k = ((offset % arr.length) + arr.length) % arr.length
  return [...arr.slice(k), ...arr.slice(0, k)]
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of arr) {
    const k = s.toLowerCase()
    if (!seen.has(k)) { seen.add(k); out.push(s) }
  }
  return out
}

// Append items to `into`, skipping any already present (case-insensitive).
function pushUnique(into: string[], items: string[]): void {
  const seen = new Set(into.map((s) => s.toLowerCase()))
  for (const s of items) {
    if (into.length >= SLOT_COUNT) break
    const k = s.toLowerCase()
    if (!seen.has(k)) { seen.add(k); into.push(s) }
  }
}
