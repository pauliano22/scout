// Stage 3: rerank a fixed candidate pool of alumni against the user's query.
//
// Hard requirements (non-negotiable per spec):
//   1. The model MUST only return IDs that exist in the candidate set. We
//      cross-check after parsing and silently drop anything else — that is
//      the anti-hallucination floor.
//   2. The model receives ONLY structured fields we already have. It cannot
//      invent a role/company/year. Reasoning text is free-form but bounded by
//      the system prompt + a length cap.
//   3. JSON output, strict shape, with a `no_matches_reason` channel so the
//      pipeline can honestly say "nothing fit" when nothing fit.

import { chatJSON } from './llm'

const MAX_RESULTS = 5
const MAX_REASONING_CHARS = 240

export interface CandidateRow {
  id: string
  full_name: string
  sport: string | null
  graduation_year: number | null
  company: string | null
  role: string | null
  industry: string | null
  location: string | null
  bio: string | null
  display_headline: string | null
  // Used only for the model's own context — never returned in reasoning.
  preScore: number
}

export interface RerankMatch {
  alumnus_id: string
  reasoning: string
}

export interface RerankResult {
  matches: RerankMatch[]
  clarifying_question: string | null
  no_matches_reason: string | null
}

const SYSTEM = `You are the ranking model for Scout's alumni search. You receive a Cornell student-athlete's query and a small candidate set of alumni profiles. Pick the alumni who are a GENUINE match — not just adjacent.

NON-NEGOTIABLE RULES:
1. Only return alumni from the candidate list, identified by their bracket number [N]. Emit that integer N in "index". Never emit a name or any number not in the list — anything out of range is discarded.
2. Never invent fields. If a candidate has no listed role/company/year, do not write a reasoning that asserts one. Stick to what's shown.
3. Tie your reasoning to the user's actual query language. Don't praise generically ("strong career", "great person"). Say WHY this person fits THIS query.
4. Quality over quantity. Return 3–5 matches at most. If fewer than 3 candidates are a genuine fit, return fewer. If NONE fit, return an empty matches array and write no_matches_reason as one short sentence that names the SPECIFIC thing THIS query asked for that the candidates lacked, and suggests one way to broaden. It must reference the user's actual query — never reuse a generic or templated reason.
5. Ask one clarifying question ONLY when the query is genuinely uninterpretable. Don't ask to "narrow it down" — narrow it yourself.

Return STRICT JSON. No prose, no markdown:
{
  "matches": [
    { "index": <integer N from the [N] brackets>, "reasoning": "<one sentence, <=240 chars, tied to the user's query>" }
  ],
  "clarifying_question": null,
  "no_matches_reason": null
}`

export async function rerankCandidates(args: {
  userQuery: string
  searchPhrase: string
  themes: string[]
  candidates: CandidateRow[]
}): Promise<RerankResult> {
  const { userQuery, searchPhrase, themes, candidates } = args

  if (candidates.length === 0) {
    return { matches: [], clarifying_question: null, no_matches_reason: 'No alumni in our index match this query yet.' }
  }

  const candidateBlock = candidates
    .map((c, i) => `[${i + 1}] name=${c.full_name}
   role=${c.role ?? '—'} | company=${c.company ?? '—'} | industry=${c.industry ?? '—'}
   sport=${c.sport ?? '—'} | class_of=${c.graduation_year ?? '—'} | location=${c.location ?? '—'}
   headline=${c.display_headline ?? '—'}
   bio=${c.bio ? c.bio.slice(0, 300) : '—'}`)
    .join('\n\n')

  const userBlock = [
    `User query: "${userQuery}"`,
    `Interpreted as: ${searchPhrase}`,
    themes.length ? `Key themes: ${themes.join('; ')}` : '',
    '',
    `Candidates (${candidates.length}):`,
    candidateBlock,
  ].filter(Boolean).join('\n')

  let raw: string
  try {
    raw = await chatJSON(SYSTEM, userBlock, 800)
  } catch (err: any) {
    console.warn('[alumni-search] rerank model error:', err?.message ?? err)
    // Fallback: honor the pre-scoring order. Better than nothing; sane reasoning text.
    return {
      matches: candidates.slice(0, 3).map((c) => ({
        alumnus_id: c.id,
        reasoning: buildFallbackReason(c),
      })),
      clarifying_question: null,
      no_matches_reason: null,
    }
  }

  return parseAndValidate(raw, candidates)
}

function parseAndValidate(raw: string, candidates: CandidateRow[]): RerankResult {
  const stripped = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
  let json: any
  try {
    json = JSON.parse(stripped)
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/)
    if (!match) return { matches: [], clarifying_question: null, no_matches_reason: null }
    try { json = JSON.parse(match[0]) } catch { return { matches: [], clarifying_question: null, no_matches_reason: null } }
  }

  const rawMatches: any[] = Array.isArray(json?.matches) ? json.matches : []

  // The model returns a 1-based bracket index; we map it back to the real id
  // here. An out-of-range index is the anti-hallucination floor — the model
  // cannot reference anyone outside the candidate list, and (unlike echoing a
  // 36-char UUID) it can't mangle a small integer into a near-miss.
  const seen = new Set<string>()
  const matches: RerankMatch[] = []
  for (const m of rawMatches) {
    if (matches.length >= MAX_RESULTS) break
    const idx = typeof m?.index === 'number' ? Math.round(m.index) : Number(m?.index)
    const reasoning = typeof m?.reasoning === 'string' ? m.reasoning.trim() : ''
    if (!Number.isInteger(idx) || idx < 1 || idx > candidates.length) {
      if (m?.index !== undefined) console.warn(`[alumni-search] dropped out-of-range index=${m.index}`)
      continue
    }
    const id = candidates[idx - 1].id
    if (seen.has(id)) continue // model occasionally repeats an index
    if (!reasoning) continue
    seen.add(id)
    matches.push({ alumnus_id: id, reasoning: reasoning.slice(0, MAX_REASONING_CHARS) })
  }

  return {
    matches,
    clarifying_question:
      typeof json?.clarifying_question === 'string' && json.clarifying_question.trim()
        ? json.clarifying_question.trim()
        : null,
    no_matches_reason:
      typeof json?.no_matches_reason === 'string' && json.no_matches_reason.trim()
        ? json.no_matches_reason.trim()
        : null,
  }
}

function buildFallbackReason(c: CandidateRow): string {
  const parts: string[] = []
  if (c.role && c.company)        parts.push(`${c.role} at ${c.company}`)
  else if (c.company)             parts.push(`At ${c.company}`)
  else if (c.role)                parts.push(`Currently ${c.role}`)
  if (c.industry)                 parts.push(`industry: ${c.industry}`)
  if (c.location)                 parts.push(c.location)
  return parts.length ? `Top match based on profile signal — ${parts.join('; ')}.` : 'Top match based on profile signal.'
}
