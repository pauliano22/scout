// Agent-side message drafting (used by the cron). A sibling to the live
// /api/generate-message route, with the adversarial fixes folded in so
// auto-prepared drafts can never embarrass a student to a real alum:
//   - HEDGE unverified facts: if role/company aren't on file (sparse corpus),
//     never assert an employer/title — a rubber-stamped draft is at worst bland.
//   - CHANNEL per-alum: email-shaped (greeting/sign-off) vs LinkedIn (≤300, none).
//   - SONNET for first-contact intros (the relationship cost of form-mail dwarfs
//     the token delta); Haiku for lower-stakes follow-ups/thank-yous.

import Anthropic from '@anthropic-ai/sdk'
import { buildUserContext } from '@/lib/ai/user-context'
import type { Alumni, Profile } from '@scout/shared/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type DraftMessageType = 'introduction' | 'follow_up' | 'thank_you'
export type DraftChannel = 'email' | 'linkedin'

const PURPOSE: Record<DraftMessageType, string> = {
  introduction: 'This is a FIRST outreach to introduce the student and request a brief call/coffee chat.',
  follow_up: 'This is ONE gentle follow-up after no reply — understanding of a busy schedule, not pushy, shorter than an intro.',
  thank_you: 'This is a THANK-YOU after a call/meeting — gratitude, reference what was discussed, offer to stay in touch.',
}

/** Decide the channel from what contact info the alum actually has. */
export function channelForAlumni(a: Pick<Alumni, 'email' | 'linkedin_url'>): DraftChannel {
  return a.email ? 'email' : 'linkedin'
}

export async function draftMessage(opts: {
  alumni: Alumni
  profile: Profile
  messageType: DraftMessageType
  channel: DraftChannel
  tone?: 'friendly' | 'neutral' | 'formal'
  goalContext?: string // e.g. "working toward informational interviews in fintech"
}): Promise<string> {
  const { alumni, profile, messageType, channel, tone = 'friendly', goalContext } = opts
  const hasRoleCompany = Boolean(alumni.role && alumni.company)

  const recipient = [
    `- Name: ${alumni.full_name}`,
    hasRoleCompany ? `- Current role: ${alumni.role} at ${alumni.company}` : null,
    alumni.industry ? `- Industry: ${alumni.industry}` : null,
    alumni.sport ? `- Played ${alumni.sport} at Cornell` : '- Cornell Athletics alum',
  ].filter(Boolean).join('\n')

  const channelInstr = channel === 'linkedin'
    ? `PLATFORM: LinkedIn note — HARD LIMIT 300 characters, NO greeting, NO sign-off, get to the point in sentence one, one clear ask at the end.`
    : `PLATFORM: Email — include a proper greeting and a sign-off using the sender's first name; 120–200 words.`

  // Integrity: a shared SPORT is only real when the sports actually match. Both
  // being Cornell athletes is always true; claiming the same sport when it differs
  // is a fabricated bond going out under the student's name.
  const sportMatched = Boolean(profile.sport && alumni.sport && profile.sport.toLowerCase() === alumni.sport.toLowerCase())
  const connectionRule = sportMatched
    ? `CONNECTION: you BOTH played ${alumni.sport} at Cornell — you may lead with that genuine shared-sport tie.`
    : `CONNECTION: you are both Cornell athletes but played DIFFERENT sports (you: ${profile.sport ?? 'your sport'}; them: ${alumni.sport ?? 'unknown'}). You MAY note being fellow Cornell athletes (true), but you must NOT claim a shared sport or imply you played the same one.`

  const factRule = hasRoleCompany
    ? 'Reference their actual role/company specifically and accurately — UNLESS the title reads as a non-literal headline or joke fragment (e.g. "People Whisperer", a cut-off phrase). In that case refer to them by company/industry, never quoting the junk title.'
    : "CRITICAL: their company and role are NOT on file. Do NOT invent or assert any employer, title, or specific fact about them. Hedge naturally — e.g. \"your path since Cornell\", \"what you've been working on\" — a vague-but-true line is required over any invented specific."

  const prompt = `Write a networking message from a current Cornell student-athlete to a Cornell alum. Output ONLY the message, no commentary.

MESSAGE TYPE: ${messageType.replace('_', ' ').toUpperCase()} — ${PURPOSE[messageType]}
${goalContext ? `STUDENT'S GOAL CONTEXT: ${goalContext}` : ''}
${channelInstr}

SENDER (STUDENT):
${buildUserContext(profile)}

RECIPIENT:
${recipient}

TONE: ${tone}.
${connectionRule}
FACTUAL RULE: ${factRule}
GENERAL: authentic, specific, human — NOT generic. No canned-spam openers ("I hope this finds you well", "I came across your profile"). Never use placeholder brackets. Vary the opening so it never reads as a template.`

  // Sonnet for the first impression to a real person; Haiku for the rest.
  const model = messageType === 'introduction' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'
  const res = await anthropic.messages.create({
    model,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })
  return res.content[0]?.type === 'text' ? res.content[0].text.trim() : ''
}
