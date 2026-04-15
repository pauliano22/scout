// ─────────────────────────────────────────────────────────────────────────────
// Scout Networking Agent — Main Orchestrator
//
// `runScoutNetworkingAgent` is the single entry point for the demo.
// It takes a user's career goal and preferences, ranks alumni, builds a plan,
// drafts messages, and returns a fully structured AgentResult — ready to
// display in the UI or print to the terminal.
//
// All steps run synchronously (no API calls). The output is deterministic
// so the demo always produces the same result for the same input.
// ─────────────────────────────────────────────────────────────────────────────

import { MOCK_ALUMNI } from './mockAlumni'
import { rankAlumni } from './score'
import { generateDrafts } from './drafts'
import type {
  AgentInput,
  AgentResult,
  PlanStep,
  WaitingItem,
  NextAction,
} from './types'

// ─── Default demo input ──────────────────────────────────────────────────────

export const DEMO_INPUT: AgentInput = {
  goal: 'Break into sports marketing',
  sport: 'Football',
  weekly_time_hours: 2,
  target_count: 3,
  preferences: {
    industries: ['Sports', 'Marketing', 'Media', 'Brand'],
    locations: ['New York', 'Boston'],
    sport: 'Football',
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildGoalSummary(input: AgentInput): string {
  const locationStr = input.preferences.locations.join(' or ')
  const timeStr = input.weekly_time_hours === 1 ? '1 hour' : `${input.weekly_time_hours} hours`
  return (
    `Scout is helping you break into ${input.goal.toLowerCase()} by identifying ` +
    `the top ${input.target_count} Cornell alumni in ${locationStr} who can open doors — ` +
    `and preparing everything you need to reach out, within your ${timeStr}/week commitment.`
  )
}

function buildPlan(input: AgentInput): PlanStep[] {
  const locationStr = input.preferences.locations[0] ?? 'your target city'
  return [
    {
      week: 1,
      action: 'Send first outreach message',
      detail: `Scout has drafted a LinkedIn message to your top match. Review it, make it yours, and send. One message, 5 minutes of your time.`,
    },
    {
      week: 1,
      action: 'Queue the next two contacts',
      detail: `While you wait for a reply, approve the remaining ${input.target_count - 1} drafts so they're ready to go the moment you have a free window.`,
    },
    {
      week: 2,
      action: 'Follow up and convert to conversations',
      detail: `If no reply by day 5, Scout will remind you to send a 2-line follow-up. Goal: at least 1 conversation scheduled in ${locationStr} this month.`,
    },
  ]
}

function buildAlreadyDid(input: AgentInput, alumniPoolSize: number): string[] {
  return [
    `Analyzed your goal: "${input.goal}"`,
    `Searched ${alumniPoolSize.toLocaleString()} Cornell athlete alumni profiles`,
    `Scored every profile against your industry, location, and sport preferences`,
    `Ranked and selected your top ${input.target_count} best-fit alumni`,
    `Generated ${input.target_count} personalized outreach drafts — ready for your review`,
    `Built a ${input.weekly_time_hours}-hour/week action plan that fits your schedule`,
  ]
}

function buildWaitingOn(drafts: ReturnType<typeof generateDrafts>): WaitingItem[] {
  const items: WaitingItem[] = [
    {
      id: 'w1',
      type: 'approve_draft',
      label: `Review and approve the draft message to ${drafts[0]?.alumniName ?? 'your top match'}`,
      draftId: drafts[0]?.id,
    },
  ]
  if (drafts.length > 1) {
    items.push({
      id: 'w2',
      type: 'review_list',
      label: `Review the ${drafts.length - 1} remaining alumni picks — confirm they look right`,
    })
  }
  return items
}

function buildNextActions(drafts: ReturnType<typeof generateDrafts>): NextAction[] {
  return [
    {
      id: 'n1',
      label: `Send approved message to ${drafts[0]?.alumniName ?? 'your top match'} via LinkedIn`,
      dueInDays: 0,
      dependsOnApproval: 'w1',
    },
    {
      id: 'n2',
      label: `Follow-up reminder if no reply from ${drafts[0]?.alumniName ?? 'your top match'}`,
      dueInDays: 5,
      dependsOnApproval: 'w1',
    },
    {
      id: 'n3',
      label: `Send outreach to the next ${drafts.length - 1} alumni in your list`,
      dueInDays: 2,
    },
    {
      id: 'n4',
      label: "Review Scout's weekly summary — who replied, what's next",
      dueInDays: 7,
    },
  ]
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Run the Scout Networking Agent.
 *
 * Pass a custom `AgentInput` or omit to use the built-in demo input.
 * Returns a fully structured `AgentResult` with all sections populated.
 */
export function runScoutNetworkingAgent(input: AgentInput = DEMO_INPUT): AgentResult {
  const pool = MOCK_ALUMNI

  // 1. Rank all alumni
  const ranked = rankAlumni(pool, input)

  // 2. Take the top N
  const topAlumni = ranked.slice(0, input.target_count)

  // 3. Generate message drafts for each
  const drafts = generateDrafts(topAlumni, input)

  // 4. Build all output sections
  return {
    input,
    goalSummary:  buildGoalSummary(input),
    plan:         buildPlan(input),
    topAlumni,
    drafts,
    alreadyDid:   buildAlreadyDid(input, pool.length),
    waitingOn:    buildWaitingOn(drafts),
    nextActions:  buildNextActions(drafts),
    generatedAt:  new Date().toISOString(),
  }
}
