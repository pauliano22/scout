// Match-argument reasoning for agent sourcing.
//
// UNLIKE the live search reranker (free-text query ranking, left untouched),
// this is fed the STUDENT's actual profile AND each candidate's work history,
// and must write a specific, non-circular MATCH ARGUMENT for EVERY candidate it
// is given. Confidence (HIGH/LOW) is decided DETERMINISTICALLY upstream in
// sourceAlumniGate — this module only produces the prose, and is called only on
// the candidates that will actually be surfaced.

import { chatJSON } from '@/lib/search/llm'
import type { WorkHistoryEntry } from '@scout/shared/types/database'

const MAX_REASONING_CHARS = 240

export interface SourcingStudent {
  name: string
  sport: string | null
  graduation_year: number | null
  industries: string[]
  roles: string[]
  locations: string[]
  goalMetric: string
}

export interface SourcingCandidate {
  id: string
  full_name: string
  sport: string | null
  graduation_year: number | null
  role: string | null
  company: string | null
  industry: string | null
  location: string | null
  work_history: WorkHistoryEntry[] | null
}

export interface SourcingReason { alumnus_id: string; reasoning: string; roleRelevant: boolean }
export interface SourcingReasonResult { matches: SourcingReason[] }

function studentLine(s: SourcingStudent): string {
  return [
    `name=${s.name}`,
    `sport=${s.sport ?? '—'}`,
    `class_of=${s.graduation_year ?? '—'}`,
    `target industry: ${s.industries.length ? s.industries.join(', ') : '(unspecified)'}`,
    `target roles: ${s.roles.length ? s.roles.join(', ') : '(unspecified)'}`,
    `target cities: ${s.locations.length ? s.locations.join(', ') : '(unspecified)'}`,
    `goal: ${s.goalMetric.replace(/_/g, ' ')}s`,
  ].join(' | ')
}

function pastEmployers(wh: WorkHistoryEntry[] | null): string {
  if (!Array.isArray(wh) || wh.length === 0) return '(none on file)'
  const named = wh
    .filter((e) => e?.company)
    .slice(0, 5)
    .map((e) => `${e.company}${e.title ? ` — ${e.title}` : ''}${e.duration ? ` (${e.duration})` : ''}`)
  return named.length ? named.join('; ') : '(none on file)'
}

function buildSystem(s: SourcingStudent): string {
  return `You are Scout's sourcing analyst. A Cornell student-athlete is running a networking campaign. For EVERY candidate alum listed, write ONE concrete MATCH ARGUMENT — why reaching out is worth it FOR THIS STUDENT.

THE STUDENT:
${studentLine(s)}

HOW TO WRITE THE REASON (this is the whole job — manufactured or generic text is a failure):
- EVERY CLAUSE MUST CARRY A VERIFIABLE FACT from the candidate's listed fields. If a clause doesn't, DELETE it. A reason of one solid fact beats two with filler.
- NAME the specific employer (never "a startup"/"a firm"/"a leading company"). Prefer the strongest evidence: a relevant NAMED employer or quantified tenure from the "past:" line outweighs a bare current title.
- State the target-city relationship as a fact: name their city; if it's a target city say so, if not say plainly it's outside it.
- SHARED SPORT — INTEGRITY RULE: mention an athlete-to-athlete connection ("fellow athlete", "shares the athlete experience", "you both played X") ONLY when the candidate line is marked "← SHARED SPORT ✓". If it is NOT marked, you are FORBIDDEN from referencing athletics, being a fellow athlete, or competitive/athletic spirit — that manufactures a bond that does not exist and it goes out under the student's name.
- NON-LITERAL TITLES: if the current title is an obvious joke, brand-y, or scraped fragment ("People Whisperer who loves", "Chief Happiness Ninja", "Growth Guru", a cut-off phrase), do NOT repeat it as a credential — refer to them by employer + industry instead (e.g. "works in media at Penske Media in LA").
- BANNED filler (delete on sight): "aligns with your goal", "can provide valuable insights", "could offer guidance", "understands the industry" — unless fused to a named specific.
- Never invent facts; use ONLY the listed fields + work history. ≤ 240 chars. Terse and concrete beats smooth.

ALSO judge roleRelevant (true/false): is this alum's ACTUAL role/work plausibly relevant to the student's target role/goal? Set false ONLY when the role is clearly OFF-TARGET and is riding on company brand or city alone — e.g. a "Building Producer" (facilities/ops) for a software-engineering goal, or an "Executive Assistant" for an analyst goal. Otherwise true. Do NOT use this to nitpick SENIORITY — a "Principal" or "VP" IS relevant for an analyst goal. When unsure, true.

Return STRICT JSON with one entry for EVERY candidate (same count as the list), no markdown:
{ "matches": [ { "index": <integer N from [N]>, "reasoning": "<the match argument>", "roleRelevant": true|false } ] }`
}

export async function reasonSourcing(
  student: SourcingStudent,
  candidates: SourcingCandidate[],
): Promise<SourcingReasonResult> {
  if (candidates.length === 0) return { matches: [] }

  const block = candidates
    .map((c, i) => {
      const shared = !!student.sport && !!c.sport && student.sport.toLowerCase() === c.sport.toLowerCase()
      return `[${i + 1}] ${c.full_name} | sport=${c.sport ?? '—'}${shared ? ' ← SHARED SPORT ✓' : ''} | class_of=${c.graduation_year ?? '—'}
   current: ${c.role ?? '—'} @ ${c.company ?? '—'} | industry=${c.industry ?? '—'} | location=${c.location ?? '—'}
   past: ${pastEmployers(c.work_history)}`
    })
    .join('\n\n')

  let raw: string
  try {
    raw = await chatJSON(buildSystem(student), `Write a match argument for EACH of these ${candidates.length} candidates:\n${block}`, 1500)
  } catch {
    return { matches: [] } // caller falls back to a deterministic line
  }
  return { matches: parse(raw, candidates) }
}

function parse(raw: string, candidates: SourcingCandidate[]): SourcingReason[] {
  const stripped = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
  let json: any
  try { json = JSON.parse(stripped) } catch {
    const m = stripped.match(/\{[\s\S]*\}/)
    if (!m) return []
    try { json = JSON.parse(m[0]) } catch { return [] }
  }
  const seen = new Set<string>()
  const out: SourcingReason[] = []
  for (const m of Array.isArray(json?.matches) ? json.matches : []) {
    const idx = Number(m?.index)
    if (!Number.isInteger(idx) || idx < 1 || idx > candidates.length) continue
    const id = candidates[idx - 1].id
    if (seen.has(id)) continue
    const reasoning = typeof m?.reasoning === 'string' ? m.reasoning.trim().slice(0, MAX_REASONING_CHARS) : ''
    if (!reasoning) continue
    seen.add(id)
    // roleRelevant defaults true — the LLM can only DOWNGRADE, never upgrade.
    out.push({ alumnus_id: id, reasoning, roleRelevant: m?.roleRelevant !== false })
  }
  return out
}
