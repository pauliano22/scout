// ─────────────────────────────────────────────────────────────────────────────
// Scout Networking Agent — Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

import { MOCK_ALUMNI } from './mockAlumni'
import { rankAlumni } from './score'
import { generateDrafts } from './drafts'
import type { AgentAlumni, AgentInput, AgentResult, NextStep, AgentStatus } from './types'

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
  input: AgentInput,
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
