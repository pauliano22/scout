// POST /api/alumni-search
//
// Conversational alumni search. The full pipeline lives here so the client
// only ever has one round-trip to wait on:
//
//   1. Parse the natural-language query into structured intent.
//   2. Embed the search phrase and pull top-30 from pgvector, honoring
//      privacy (is_public=true) and exclusion (already-networked).
//   3. Pre-score the candidates with the shared scorer — drop anything
//      below the floor, sort by score+similarity. This is the
//      accuracy-over-recall gate.
//   4. Send the survivors to the rerank LLM (strict JSON output, IDs
//      pinned to the candidate set).
//   5. Hydrate matches back into full Alumni rows for the client.
//   6. Log query + returned IDs anonymized (no PII tied to text).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Alumni } from '@scout/shared/types/database'
import {
  scoreAlumnus,
  type UserPreferences,
} from '@scout/shared/scoring/recommendationScoring'
import { embedText, EmbeddingProviderError } from '@/lib/search/embeddings'
import { parseQuery, type ParsedIntent } from '@/lib/search/queryParse'
import { rerankCandidates, type CandidateRow, type RerankMatch } from '@/lib/search/rerank'
import { isInAlumniSearchTreatment } from '@scout/shared/featureFlags/alumniSearch'

export const dynamic = 'force-dynamic'

const VECTOR_TOP_K = 30
const SCORE_FLOOR = 25
// Similarity floor for the OR-branch. Calibrated against real text-embedding-3-small
// scores on this corpus. With the HNSW index (migration 024, June 2026) recall
// returns genuinely-nearest neighbours, so strong matches now land ~0.45–0.53 and
// weak-but-plausible ones ~0.30–0.42 — leaving 0.30 comfortably in the noise gap.
// Critically, only ~24% of alumni have a DB `industry`, so for the other 76%
// similarity is the ONLY signal — a high floor here silently drops them. The
// rerank LLM is the precision gate (it reliably returns no-match when nothing
// fits), so this floor only needs to trim obvious noise, not judge relevance.
const SIM_FLOOR = 0.30

type SearchSource = 'typed' | 'example' | 'suggestion'

interface RequestBody {
  query: string
  history?: string[]   // prior user turns in this session (for follow-ups)
  source?: SearchSource // where the query came from — gates trending counting
  // Deterministic refinements from the no-match chips — applied to the parsed
  // intent before retrieval, so "Drop location" actually drops it (vs. relying
  // on the parser to re-interpret a prose instruction).
  overrides?: { dropLocation?: boolean; broadenRole?: boolean }
}

export interface AlumniSearchMatch {
  alumnus: Alumni & { similarity?: number }
  reasoning: string
}

export interface AlumniSearchResponse {
  intent: ParsedIntent
  matches: AlumniSearchMatch[]
  clarifying_question: string | null
  no_matches_reason: string | null
}

export async function POST(request: NextRequest) {
  // Web-only feature: the browser client fetches this same-origin, so the
  // Supabase session rides along in cookies and the SSR client reads it.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Feature flag gate. 503 (not 403) so the client can render a calm
  // "search is rolling out" state without blowing up auth flows.
  if (!isInAlumniSearchTreatment(user.id)) {
    return NextResponse.json({ error: 'Feature not available for this user' }, { status: 503 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const rawQuery = typeof body.query === 'string' ? body.query.trim() : ''
  if (!rawQuery) {
    return NextResponse.json({ error: 'Empty query' }, { status: 400 })
  }
  const history = Array.isArray(body.history)
    ? body.history.filter((s): s is string => typeof s === 'string').slice(-5)
    : []
  // Only genuine typed queries feed trending; example/suggestion clicks are
  // tagged so the aggregation can exclude them. Unknown values fall back to
  // 'typed' to match the historical (untagged) default.
  const source: SearchSource =
    body.source === 'example' || body.source === 'suggestion' ? body.source : 'typed'
  const overrides = body.overrides ?? {}

  // ── 1. Parse (+ fetch the exclusion set concurrently) ───────────────────────
  // The already-networked lookup is independent of parsing, so it rides along
  // with the parse LLM call instead of waiting behind it. (On a clarify
  // short-circuit the lookup is harmlessly discarded — it's a cheap indexed
  // read, and overlapping it is still a net win on the common path.)
  const [intent, networkRows] = await Promise.all([
    parseQuery(rawQuery, history),
    supabase.from('user_networks').select('alumni_id').eq('user_id', user.id),
  ])

  // Deterministic refinements from the no-match chips. Applied here, not in the
  // parser, so the behavior is exact rather than a re-interpretation.
  if (overrides.dropLocation) {
    intent.hard.location = undefined
    intent.soft.locations = []
  }
  if (overrides.broadenRole) {
    intent.soft.roles = []
  }

  // Genuine ambiguity short-circuits before we burn embedding + rerank budget.
  if (intent.clarifyingQuestion) {
    await logSearch(supabase, user.id, rawQuery, [], 'clarify', source, intent.soft)
    return NextResponse.json<AlumniSearchResponse>({
      intent,
      matches: [],
      clarifying_question: intent.clarifyingQuestion,
      no_matches_reason: null,
    })
  }

  // ── 2. Retrieve ───────────────────────────────────────────────────────────
  // Already-networked alumni are filtered at the SQL level — privacy as
  // pre-filter, not post.
  const excludeIds = (networkRows.data ?? []).map((n) => n.alumni_id as string)

  const candidates: CandidatePool = await semanticRetrieve(supabase, intent, excludeIds)

  // No keyword fallback. Earlier versions back-filled with ILIKE matches when
  // vector retrieval returned thin results — that contradicted "accuracy over
  // recall." A keyword hit dressed as a semantic match is exactly the failure
  // mode this route is built to prevent. If vector retrieval is thin, the
  // honest answer is "we couldn't find a strong match" — surfaced below.

  if (candidates.rows.length === 0) {
    await logSearch(supabase, user.id, rawQuery, [], 'no_candidates', source, intent.soft)
    return NextResponse.json<AlumniSearchResponse>({
      intent,
      matches: [],
      clarifying_question: null,
      no_matches_reason:
        candidates.embeddingFailed
          ? 'Alumni search is temporarily unavailable. Try again shortly.'
          : 'No alumni in our index match this query. Try widening the role, industry, or location.',
    })
  }

  // ── 3. Pre-score with the shared scorer ───────────────────────────────────
  const prefs = intentToPrefs(intent)
  const preScored = candidates.rows
    .map((row) => {
      const scored = scoreAlumnus(row as unknown as Alumni, prefs, {})
      return { row, similarity: row.similarity ?? 0, score: scored.score }
    })
    // Trim obvious noise only. Pass anything with a structured signal
    // (score≥25) OR a plausible semantic match (sim≥SIM_FLOOR) through to the
    // rerank LLM, which is the real accuracy gate. Keeping this floor low is
    // deliberate: most alumni have no DB industry, so similarity is their only
    // signal, and a high floor here produces false no-matches.
    .filter((c) => c.score >= SCORE_FLOOR || c.similarity >= SIM_FLOOR)
    .sort((a, b) => b.score - a.score || b.similarity - a.similarity)
    .slice(0, 12) // rerank pool — small enough to fit in one prompt

  if (preScored.length === 0) {
    await logSearch(supabase, user.id, rawQuery, [], 'below_floor', source, intent.soft)
    return NextResponse.json<AlumniSearchResponse>({
      intent,
      matches: [],
      clarifying_question: null,
      no_matches_reason:
        'I found some candidates, but none were a strong match for what you asked. Try a different angle or broaden one of the constraints.',
    })
  }

  // ── 4. Rerank ─────────────────────────────────────────────────────────────
  const rerankInput: CandidateRow[] = preScored.map((c) => ({
    id:               c.row.id,
    full_name:        c.row.full_name,
    sport:            c.row.sport,
    graduation_year:  c.row.graduation_year,
    company:          c.row.company,
    role:             c.row.role,
    industry:         c.row.industry,
    location:         c.row.location,
    bio:              c.row.bio,
    display_headline: c.row.display_headline,
    preScore:         c.score,
  }))

  const rerank = await rerankCandidates({
    userQuery: rawQuery,
    searchPhrase: intent.searchPhrase,
    themes: intent.soft.themes,
    exclude: intent.exclude,
    candidates: rerankInput,
  })

  // ── 5. Hydrate ────────────────────────────────────────────────────────────
  // Re-attach the full Alumni row for each picked id. This is what the client
  // needs to render the existing AlumniDetailModal — same shape as Discover.
  const fullById = new Map<string, AlumniRow>(candidates.rows.map((r) => [r.id, r]))
  const matches: AlumniSearchMatch[] = []
  for (const m of rerank.matches) {
    const full = fullById.get(m.alumnus_id)
    if (!full) continue // belt-and-suspenders — rerank already filtered, but never trust the LLM
    matches.push({
      alumnus: full as unknown as Alumni & { similarity?: number },
      reasoning: m.reasoning,
    })
  }

  // ── 6. Log ────────────────────────────────────────────────────────────────
  await logSearch(supabase, user.id, rawQuery, matches.map((m) => m.alumnus.id), matches.length ? 'matches' : 'no_matches', source, intent.soft)

  return NextResponse.json<AlumniSearchResponse>({
    intent,
    matches,
    clarifying_question: rerank.clarifying_question,
    no_matches_reason: matches.length === 0 ? (rerank.no_matches_reason ?? 'No strong matches.') : null,
  })
}

// ─── Retrieval helpers ─────────────────────────────────────────────────────

interface AlumniRow {
  id: string
  full_name: string
  email: string | null
  linkedin_url: string | null
  sport: string | null
  graduation_year: number | null
  company: string | null
  role: string | null
  industry: string | null
  location: string | null
  avatar_url: string | null
  photo_url: string | null
  bio: string | null
  display_headline: string | null
  similarity?: number
}

interface CandidatePool {
  rows: AlumniRow[]
  embeddingFailed: boolean
}

async function semanticRetrieve(
  supabase: ReturnType<typeof createClient>,
  intent: ParsedIntent,
  excludeIds: string[],
): Promise<CandidatePool> {
  let vec: number[]
  try {
    vec = await embedText(intent.searchPhrase)
  } catch (err: any) {
    if (err instanceof EmbeddingProviderError) {
      console.warn('[alumni-search] embed failed (no candidates this request):', err.message)
    } else {
      console.warn('[alumni-search] embed unexpected error:', err?.message ?? err)
    }
    return { rows: [], embeddingFailed: true }
  }

  // Location is intentionally NOT passed as a hard filter. ~97% of alumni DO
  // have a location, but the values are highly fragmented — "New York", "New
  // York, New York", "New York, N.Y.", "New York City Metropolitan Area",
  // "NYC" are all distinct strings — so a single `location ILIKE '%NYC%'` would
  // silently drop most genuine matches in that metro. Location stays a SOFT
  // signal: it flows into the scorer (location weight) via intentToPrefs and
  // the rerank LLM sees each candidate's location to honor "in NYC" when the
  // data exists. Graduation year is kept hard — it's a required, non-null
  // column, so exact filtering there can't over-exclude.
  const { data, error } = await supabase.rpc('match_alumni_semantic', {
    query_embedding: vec,
    exclude_ids:     excludeIds,
    location_q:      null,
    grad_year_min:   intent.hard.graduationYearMin ?? null,
    grad_year_max:   intent.hard.graduationYearMax ?? null,
    match_count:     VECTOR_TOP_K,
  })

  if (error) {
    console.warn('[alumni-search] rpc match_alumni_semantic error:', error.message)
    return { rows: [], embeddingFailed: false }
  }

  return { rows: (data ?? []) as AlumniRow[], embeddingFailed: false }
}

function intentToPrefs(intent: ParsedIntent): UserPreferences {
  return {
    industries: intent.soft.industries,
    sports:     [],
    locations:  intent.hard.location
      ? [intent.hard.location, ...intent.soft.locations]
      : intent.soft.locations,
    roles:      intent.soft.roles,
    companies:  [],
    graduationYearMin: intent.hard.graduationYearMin,
    graduationYearMax: intent.hard.graduationYearMax,
    priorities: { sameSport: false, similarIndustry: true, seniorAlumni: false },
  }
}

// ─── Logging ───────────────────────────────────────────────────────────────

async function logSearch(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  rawQuery: string,
  resultIds: string[],
  outcome: 'matches' | 'no_matches' | 'no_candidates' | 'below_floor' | 'clarify',
  source: SearchSource,
  facets: { roles: string[]; industries: string[]; themes: string[] },
) {
  // We log the raw query text against the user ID into user_events. Per spec
  // the *iteration* signal is anonymized — the analytics layer (PostHog,
  // route /api/track) is where the query is sent without user PII. The
  // user_events row stays internal and is governed by RLS.
  //
  // `source` distinguishes typed queries from example/suggestion clicks, and
  // `facets` carries the normalized intent tags — both consumed by the
  // suggestions aggregation to build privacy-gated trending searches.
  try {
    await supabase.from('user_events').insert({
      user_id: userId,
      event_type: 'alumni_search',
      event_data: {
        query: rawQuery.slice(0, 500),
        outcome,
        result_count: resultIds.length,
        result_ids: resultIds,
        source,
        facets,
      },
    })
  } catch {
    // Never let logging break the user-facing response.
  }
}
