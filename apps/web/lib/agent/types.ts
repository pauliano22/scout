// ─────────────────────────────────────────────────────────────────────────────
// Scout Networking Agent — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** What the user tells Scout they want. */
export interface AgentInput {
  goal: string
  sport: string                 // user's sport (for shared-connection scoring)
  weekly_time_hours: number
  target_count: number
  preferences: {
    industries: string[]        // keyword list, case-insensitive matched
    locations: string[]         // partial match against alumni.location
    sport?: string              // preferred alumni sport (bonus, not required)
  }
}

/** One alumni record used inside the agent (subset of the real Alumni type). */
export interface AgentAlumni {
  id: string
  full_name: string
  sport: string
  graduation_year: number
  company: string | null
  role: string | null
  industry: string | null
  location: string | null
  linkedin_url: string | null
}

/** Alumni ranked with a score and human-readable reason. */
export interface RankedAlumni extends AgentAlumni {
  score: number
  reason: string          // one sentence Scout writes about why this person
  scoreBreakdown: {
    industryMatch: number
    sportMatch: number
    locationMatch: number
    profileQuality: number
  }
}

/** A drafted outreach message, with approval state. */
export interface DraftMessage {
  id: string
  alumniId: string
  alumniName: string
  platform: 'linkedin' | 'email'
  subject: string | null   // only for email
  body: string
  status: 'pending' | 'approved' | 'skipped'
  approvedAt?: string
  followUpQueuedFor?: string  // ISO date string if follow-up was queued
}

/** A single step in the agent's generated plan. */
export interface PlanStep {
  week: number
  action: string
  detail: string
}

/** The structured output of a full agent run. */
export interface AgentResult {
  input: AgentInput
  goalSummary: string               // one sentence Scout writes about the goal
  plan: PlanStep[]
  topAlumni: RankedAlumni[]
  drafts: DraftMessage[]
  alreadyDid: string[]              // things Scout completed automatically
  waitingOn: WaitingItem[]          // things needing user approval
  nextActions: NextAction[]
  generatedAt: string               // ISO timestamp
}

export interface WaitingItem {
  id: string
  type: 'approve_draft' | 'confirm_plan' | 'review_list'
  label: string
  draftId?: string                  // linked draft when type = 'approve_draft'
}

export interface NextAction {
  id: string
  label: string
  dueInDays: number
  dependsOnApproval?: string        // waiting item id this unlocks
}
