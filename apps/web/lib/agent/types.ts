// ─────────────────────────────────────────────────────────────────────────────
// Scout Networking Agent — Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentInput {
  goal: string             // raw user goal, e.g. "Break into sports marketing"
  goalDomain: string       // cleaned, e.g. "sports marketing"
  sport: string            // user's own sport
  weekly_time_hours: number
  target_count: number
  preferences: {
    industries: string[]   // keyword list, matched case-insensitively
    locations: string[]    // partial matched against alumni.location
    sport?: string         // preferred alumni sport (bonus)
  }
}

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

export interface RankedAlumni extends AgentAlumni {
  score: number
  reason: string                 // one-line, shown in UI
  tags: AlumniTag[]              // compact match labels
}

export type AlumniTag =
  | { type: 'sport';    label: string }
  | { type: 'industry'; label: string }
  | { type: 'location'; label: string }

export interface DraftMessage {
  id: string
  alumniId: string
  alumniName: string
  platform: 'linkedin'
  body: string
  status: 'pending' | 'approved' | 'skipped'
  approvedAt?: string
}

/** The single most important action right now. */
export interface NextStep {
  alumniId: string
  headline: string    // "Reach out to James Rivera at Octagon."
  subline: string     // "Cornell Football → Sports Marketing. Your most direct path."
  draftId: string
}

/** Three-line status summary — no more, no less. */
export interface AgentStatus {
  prepared: string   // "3 matches · 3 drafts ready"
  waiting: string    // "Approve outreach to James Rivera"
  next: string       // "Follow-up Friday if no reply"
}

export interface AgentResult {
  // Tracking IDs
  goalId: string
  agentRunId: string

  input: AgentInput
  topAlumni: RankedAlumni[]
  drafts: DraftMessage[]
  nextStep: NextStep
  status: AgentStatus
  generatedAt: string
}
