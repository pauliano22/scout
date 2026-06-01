// Stage 1: turn a natural-language query into structured search intent.
//
// This is a small/fast LLM call (OpenAI gpt-4o-mini via chatJSON). Its only
// job is to convert "I'm a sophomore interested in PM at fintech startups in
// NYC" into the hard-vs-soft filter split + a normalized search phrase used
// for embedding. The model is also allowed to say "this is ambiguous, ask
// the user X" — but ONLY when the query genuinely has no usable signal.
//
// Output is strict JSON; an unparseable response degrades to a safe
// fallback where everything is a soft preference and we run the
// retrieval anyway. Better to return mediocre results than to fail.

import { chatJSON } from './llm'

export interface ParsedIntent {
  /** Natural rewrite used for the embedding query — denser, no fluff. */
  searchPhrase: string
  /** Soft preferences — score boosts, not filters. */
  soft: {
    industries: string[]
    roles: string[]
    locations: string[]
    themes: string[]            // free-text concepts ("pivoted from consulting", "founder failure")
  }
  /** Hard filters — applied at SQL/RPC time. Empty when not specified. */
  hard: {
    location?: string           // single substring for ILIKE
    graduationYearMin?: number
    graduationYearMax?: number
  }
  /** Set ONLY when the model thinks the query is genuinely ambiguous. */
  clarifyingQuestion: string | null
}

const SYSTEM = `You translate a Scout user's natural-language search into structured intent. Scout is a Cornell student-athlete networking platform — users want to find alumni who match their query.

Return STRICT JSON with this exact shape:
{
  "searchPhrase": string,                       // dense rewrite for semantic search (max 200 chars)
  "soft": {
    "industries": string[],                     // e.g. ["Finance", "Fintech"]
    "roles":      string[],                     // e.g. ["Product Manager"]
    "locations":  string[],                     // e.g. ["New York", "NYC"]
    "themes":     string[]                      // e.g. ["pivoted from consulting", "founded before med school"]
  },
  "hard": {
    "location":         string | null,          // ONLY if user said "in X" — single substring for SQL ILIKE
    "graduationYearMin": number | null,         // ONLY if user said "recent grads" or gave a year range
    "graduationYearMax": number | null
  },
  "clarifyingQuestion": string | null
}

RULES:
- For "industries", map to this EXACT set (the values our database uses): Technology, Finance, Education, Healthcare, Consulting, Law, Media, Sports, Real Estate, Government, Nonprofit, Manufacturing. Translate the user's words into these (e.g. "fintech"/"private equity"/"VC"/"banking" → Finance; "biotech"/"pharma"/"med" → Healthcare; "climate tech"/"startup" → Technology; "PR"/"journalism" → Media). If nothing fits, use []. Put the user's own finer-grained wording in "themes" instead.
- A filter is HARD only when the user explicitly anchors it ("in NYC", "graduated after 2020"). Everything else is soft.
- Themes capture intent the structured fields can't ("pivoted from X to Y", "took a gap year", "founded a company that failed", "fintech", "private equity"). Keep them short and specific.
- Set clarifyingQuestion ONLY when the query is so vague NO retrieval would be meaningful. "I want to network" → ask. "I'm in PM" → don't ask, search PM. When in doubt, do NOT ask.
- Never invent a clarifying question to gather more filters. The retrieval handles fuzziness.
- searchPhrase is the canonical form you'd embed — drop "I'm a sophomore", keep the substance.
- Output JSON only. No prose, no code fences.`

export async function parseQuery(rawQuery: string, recentTurns: string[] = []): Promise<ParsedIntent> {
  const cleaned = rawQuery.trim().slice(0, 500)

  // Compose the user message with up to ~3 previous queries to support
  // follow-ups like "narrow to Boston" or "more like the second one".
  const history = recentTurns.length
    ? `Earlier in this conversation the user said:\n${recentTurns.slice(-3).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nCurrent query: `
    : ''

  let raw: string
  try {
    raw = await chatJSON(SYSTEM, `${history}${cleaned}`, 400)
  } catch (err: any) {
    console.warn('[alumni-search] parseQuery model error:', err?.message ?? err)
    return safeFallback(cleaned)
  }

  return parseJsonOrFallback(raw, cleaned)
}

function parseJsonOrFallback(raw: string, original: string): ParsedIntent {
  const stripped = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
  let json: any
  try {
    json = JSON.parse(stripped)
  } catch {
    // Salvage attempt — find first { ... }
    const match = stripped.match(/\{[\s\S]*\}/)
    if (!match) return safeFallback(original)
    try {
      json = JSON.parse(match[0])
    } catch {
      return safeFallback(original)
    }
  }
  return normalize(json, original)
}

function normalize(json: any, original: string): ParsedIntent {
  const soft = json?.soft ?? {}
  const hard = json?.hard ?? {}
  return {
    searchPhrase: typeof json?.searchPhrase === 'string' && json.searchPhrase.trim()
      ? json.searchPhrase.trim().slice(0, 300)
      : original,
    soft: {
      industries: asStringArray(soft.industries),
      roles:      asStringArray(soft.roles),
      locations:  asStringArray(soft.locations),
      themes:     asStringArray(soft.themes),
    },
    hard: {
      location:          typeof hard.location === 'string' && hard.location.trim() ? hard.location.trim() : undefined,
      graduationYearMin: Number.isFinite(hard.graduationYearMin) ? hard.graduationYearMin : undefined,
      graduationYearMax: Number.isFinite(hard.graduationYearMax) ? hard.graduationYearMax : undefined,
    },
    clarifyingQuestion: typeof json?.clarifyingQuestion === 'string' && json.clarifyingQuestion.trim()
      ? json.clarifyingQuestion.trim()
      : null,
  }
}

function asStringArray(v: any): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x) => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function safeFallback(original: string): ParsedIntent {
  return {
    searchPhrase: original,
    soft: { industries: [], roles: [], locations: [], themes: [] },
    hard: {},
    clarifyingQuestion: null,
  }
}
