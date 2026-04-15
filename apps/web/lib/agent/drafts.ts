// ─────────────────────────────────────────────────────────────────────────────
// Scout Networking Agent — Draft Message Generator
//
// Produces short, natural outreach messages in a student-athlete voice.
// Deterministic — no API call required. Each template is personalized
// using alumni and user context to avoid feeling robotic.
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentInput, DraftMessage, RankedAlumni } from './types'

/** Simple ID generator (no crypto dependency). */
function draftId(alumniId: string): string {
  return `draft_${alumniId}_${Date.now().toString(36)}`
}

/** Pick a template variant based on what we know about the alumni. */
function buildBody(alumni: RankedAlumni, input: AgentInput): string {
  const sharedSport = alumni.scoreBreakdown.sportMatch > 0
  const firstName = alumni.full_name.split(' ')[0]
  const currentYear = new Date().getFullYear()
  const yearsOut = currentYear - alumni.graduation_year

  // Shared sport + same career direction — most personal template
  if (sharedSport && alumni.scoreBreakdown.industryMatch > 0) {
    return [
      `Hi ${firstName} —`,
      ``,
      `I'm a current Cornell ${input.preferences.sport ?? 'athlete'} looking to break into ${input.goal.toLowerCase()}. Your path from Cornell athletics to ${alumni.role ?? 'your current role'}${alumni.company ? ` at ${alumni.company}` : ''} is exactly what I'm trying to figure out.`,
      ``,
      `Would you be open to a quick 15-minute call? I'd love to hear how you made the transition and any advice you'd give someone in my position.`,
      ``,
      `Thanks for considering it.`,
    ].join('\n')
  }

  // Shared sport, different industry — shorter, curiosity-driven
  if (sharedSport) {
    return [
      `Hi ${firstName} —`,
      ``,
      `Cornell ${input.preferences.sport ?? 'football'} here. I've been exploring careers in ${input.preferences.industries[0] ?? 'your field'} and your background caught my attention — especially${alumni.company ? ` your work at ${alumni.company}` : ' your career path'}.`,
      ``,
      `If you have 15 minutes to chat, I'd really appreciate hearing your perspective. Happy to work around your schedule.`,
    ].join('\n')
  }

  // Industry match, no sport overlap — more professional but still warm
  if (alumni.scoreBreakdown.industryMatch > 0) {
    const yearsNote = yearsOut >= 5 ? `You've had ${yearsOut} years building your career in this space` : `You've been building your career in this space since graduating Cornell`
    return [
      `Hi ${firstName} —`,
      ``,
      `I'm a Cornell student-athlete trying to break into ${input.goal.toLowerCase()}. ${yearsNote}, and your role${alumni.company ? ` at ${alumni.company}` : ''} looks like exactly where I want to be heading.`,
      ``,
      `Any chance you'd be open to a brief call? Even 10 minutes of your time would go a long way for me.`,
      ``,
      `— A fellow Big Red athlete`,
    ].join('\n')
  }

  // Generic Cornell athlete fallback
  return [
    `Hi ${firstName} —`,
    ``,
    `I'm a current Cornell athlete working toward a career in ${input.goal.toLowerCase()}. I came across your profile and was really impressed by your path since graduating.`,
    ``,
    `Would you be open to a quick conversation? I'd love to hear what you've learned and what you'd do differently starting out.`,
  ].join('\n')
}

/**
 * Generate one draft per alumni in the top picks.
 * Platform defaults to LinkedIn (short, no subject needed).
 */
export function generateDrafts(
  topAlumni: RankedAlumni[],
  input: AgentInput,
): DraftMessage[] {
  return topAlumni.map(alumni => ({
    id: draftId(alumni.id),
    alumniId: alumni.id,
    alumniName: alumni.full_name,
    platform: 'linkedin' as const,
    subject: null,
    body: buildBody(alumni, input),
    status: 'pending' as const,
  }))
}
