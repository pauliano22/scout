// ─────────────────────────────────────────────────────────────────────────────
// Scout Networking Agent — Draft Generator
//
// Short, natural, student-athlete voice. No jargon. No "I am reaching out."
// Deterministic — no API call required.
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentInput, DraftMessage, RankedAlumni } from './types'

function firstName(fullName: string): string {
  return fullName.split(' ')[0]
}

function buildBody(alumni: RankedAlumni, input: AgentInput): string {
  const name = firstName(alumni.full_name)
  const sharedSport = alumni.tags.some(t => t.type === 'sport')
  const industryMatch = alumni.tags.some(t => t.type === 'industry')
  const sport = input.preferences.sport ?? input.sport
  const domain = input.goalDomain  // e.g. "sports marketing"

  // Template A: Shared sport + same career direction — most direct
  if (sharedSport && industryMatch && alumni.role && alumni.company) {
    return [
      `Hi ${name} —`,
      ``,
      `I'm a current Cornell ${sport} player working toward a career in ${domain}. Your path from Cornell athletics to ${alumni.role} at ${alumni.company} is exactly what I'm trying to figure out.`,
      ``,
      `Would you be open to a 15-minute call? I'd love to hear how you made that transition.`,
    ].join('\n')
  }

  // Template B: Shared sport, career adjacent
  if (sharedSport && alumni.company) {
    return [
      `Hi ${name} —`,
      ``,
      `Cornell ${sport} here. I've been exploring careers in ${domain} and your background at ${alumni.company} caught my attention.`,
      ``,
      `If you have 15 minutes to chat sometime, I'd genuinely appreciate it.`,
    ].join('\n')
  }

  // Template C: Industry match, no sport overlap
  if (industryMatch && alumni.role && alumni.company) {
    const yrsOut = new Date().getFullYear() - alumni.graduation_year
    return [
      `Hi ${name} —`,
      ``,
      `I'm a Cornell student-athlete aiming for a career in ${domain}. You've been building your career in this space for ${yrsOut} years — I'd love to hear what you'd tell someone just starting out.`,
      ``,
      `Any chance you'd be open to a quick call?`,
    ].join('\n')
  }

  // Template D: Generic Cornell athlete fallback
  return [
    `Hi ${name} —`,
    ``,
    `I'm a current Cornell athlete working toward ${domain}. I came across your profile and was impressed by your path since graduating.`,
    ``,
    `Would you be open to a quick conversation? Even 10 minutes would mean a lot.`,
  ].join('\n')
}

export function generateDrafts(
  topAlumni: RankedAlumni[],
  input: AgentInput,
): DraftMessage[] {
  return topAlumni.map((alumni, i) => ({
    id: `draft_${alumni.id}_${i}`,
    alumniId: alumni.id,
    alumniName: alumni.full_name,
    platform: 'linkedin' as const,
    body: buildBody(alumni, input),
    status: 'pending' as const,
  }))
}
