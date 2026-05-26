// ─────────────────────────────────────────────────────────────────────────────
// Scout Networking Agent — Orchestrator
//
// Ranking is delegated to the unified scorer in @scout/shared. The agent only
// adapts its own input/output shapes around it (AgentInput -> UserPreferences,
// AgentAlumni -> Alumni, ScoredAlumni -> RankedAlumni).
// ─────────────────────────────────────────────────────────────────────────────

import type { Alumni } from '@scout/shared/types/database'
import {
  scoreAlumnus,
  type UserPreferences,
} from '@scout/shared/scoring/recommendationScoring'
import { MOCK_ALUMNI } from './mockAlumni'
import { generateDrafts } from './drafts'
import type {
  AgentAlumni, AgentInput, AgentResult, AlumniTag, NextStep, AgentStatus,
  RankedAlumni,
} from './types'

// ─── Deterministic ID generation (no crypto dependency) ──────────────────────

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

// ─── Goal normalization ───────────────────────────────────────────────────────

function extractGoalDomain(goal: string): string {
  return goal
    .replace(/^(break|get|move|step|transition)\s+into\s+/i, '')
    .replace(/^pursue\s+/i, '')
    .replace(/^become\s+a\s+/i, '')
    .trim()
    .toLowerCase()
}

// ─── Demo input ───────────────────────────────────────────────────────────────

export const DEMO_INPUT: Omit<AgentInput, 'goalDomain'> = {
  goal:               'Break into sports marketing',
  sport:              'Football',
  weekly_time_hours:  2,
  target_count:       3,
  preferences: {
    industries: ['Sports', 'Marketing', 'Media', 'Brand'],
    locations:  ['New York', 'Boston'],
    sport:      'Football',
  },
}

// ─── Adapters: AgentAlumni <-> Alumni, AgentInput -> UserPreferences ──────────

function agentToAlumni(a: AgentAlumni): Alumni {
  // scoreAlumnus reads through normalizeAlumniProfile, which tolerates the
  // fields we don't have (work_history, education, photo, …). Cast keeps the
  // type system happy without inventing fake values for the rich-profile fields.
  return {
    id: a.id,
    full_name: a.full_name,
    email: null,
    linkedin_url: a.linkedin_url,
    sport: a.sport,
    graduation_year: a.graduation_year,
    company: a.company,
    role: a.role,
    industry: a.industry,
    location: a.location,
  } as unknown as Alumni
}

function agentInputToPrefs(input: AgentInput): UserPreferences {
  return {
    industries: input.preferences.industries,
    sports:     input.preferences.sport ? [input.preferences.sport] : [],
    locations:  input.preferences.locations,
    roles:      [],
    companies:  [],
    priorities: { sameSport: true, similarIndustry: true, seniorAlumni: false },
  }
}

function buildTagsFromBreakdown(
  alumni: AgentAlumni,
  prefs: UserPreferences,
  breakdown: { industry: number; sport: number; location: number },
): AlumniTag[] {
  const tags: AlumniTag[] = []
  if (breakdown.sport > 0 && alumni.sport) {
    tags.push({ type: 'sport', label: alumni.sport })
  }
  if (breakdown.industry > 0) {
    const matched = prefs.industries.find(
      (kw) => alumni.industry?.toLowerCase().includes(kw.toLowerCase()),
    ) ?? alumni.industry ?? ''
    if (matched) tags.push({ type: 'industry', label: matched })
  }
  if (breakdown.location > 0 && alumni.location) {
    tags.push({ type: 'location', label: alumni.location.split(',')[0] })
  }
  return tags
}

function buildReasonFromMatch(
  alumni: AgentAlumni,
  why: string[],
  tags: AlumniTag[],
): string {
  if (why.length > 0) return why.slice(0, 2).join(' · ') + '.'
  // Fallback to the original-shape sentence used pre-unification.
  const parts: string[] = []
  const sport = tags.find((t) => t.type === 'sport')
  if (sport) parts.push(`Cornell ${sport.label}`)
  if (alumni.role && alumni.company) parts.push(`${alumni.role} at ${alumni.company}`)
  else if (alumni.company) parts.push(alumni.company)
  return parts.length ? parts.join(' · ') + '.' : 'Cornell athlete, relevant career path.'
}

// ─── Ranking — thin wrapper over the shared scorer ───────────────────────────

export function rankAlumni(pool: AgentAlumni[], input: AgentInput): RankedAlumni[] {
  const prefs = agentInputToPrefs(input)
  const ranked = pool.map((a) => {
    const scored = scoreAlumnus(agentToAlumni(a), prefs, {})
    const tags = buildTagsFromBreakdown(a, prefs, scored.scoreBreakdown)
    return {
      alumni: a,
      industryMatched: scored.scoreBreakdown.industry > 0,
      ranked: {
        ...a,
        score: scored.score,
        tags,
        reason: buildReasonFromMatch(a, scored.whyThisMatch, tags),
      } as RankedAlumni,
    }
  })

  const filtered = input.strictFieldFilter
    ? ranked.filter((r) => r.industryMatched)
    : ranked

  return filtered
    .map((r) => r.ranked)
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
}

// ─── Builders ────────────────────────────────────────────────────────────────

function buildNextStep(result: Pick<AgentResult, 'topAlumni' | 'drafts'>): NextStep {
  const top = result.topAlumni[0]
  const draft = result.drafts[0]
  const cityStr = top.location ? top.location.split(',')[0] : ''
  const roleStr = top.role && top.company
    ? `${top.role} at ${top.company}`
    : top.company ?? 'their current role'

  return {
    alumniId: top.id,
    draftId:  draft.id,
    headline: `Reach out to ${top.full_name.split(' ')[0]} at ${top.company ?? 'their company'}.`,
    subline: [
      `Cornell ${top.sport} → ${roleStr}`,
      cityStr,
    ].filter(Boolean).join(' · '),
  }
}

function buildStatus(
  _input: AgentInput,
  topAlumniCount: number,
  firstAlumniName: string,
): AgentStatus {
  return {
    prepared: `${topAlumniCount} matches · ${topAlumniCount} drafts ready`,
    waiting:  `Approve outreach to ${firstAlumniName.split(' ')[0]}`,
    next:     'Follow-up Friday if no reply',
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function runScoutNetworkingAgent(
  rawInput: Omit<AgentInput, 'goalDomain'> = DEMO_INPUT,
  alumniPool?: AgentAlumni[],
): AgentResult {
  const input: AgentInput = {
    ...rawInput,
    goalDomain: extractGoalDomain(rawInput.goal),
  }

  const pool = alumniPool ?? MOCK_ALUMNI
  const ranked     = rankAlumni(pool, input)
  const topAlumni  = ranked.slice(0, input.target_count)
  const drafts     = generateDrafts(topAlumni, input)
  const partial    = { topAlumni, drafts }

  return {
    goalId:     makeId('goal'),
    agentRunId: makeId('run'),
    input,
    topAlumni,
    drafts,
    nextStep:    buildNextStep(partial),
    status:      buildStatus(input, topAlumni.length, topAlumni[0]?.full_name ?? 'your match'),
    generatedAt: new Date().toISOString(),
  }
}
