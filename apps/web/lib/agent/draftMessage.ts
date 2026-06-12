// Agent-side message drafting (picks + cron). Built on the shared outreach
// prompt core (lib/agent/outreach.ts) — the same voice and integrity rules as
// the live /api/generate-message route, so auto-prepared drafts can never
// embarrass a student to a real alum:
//   - HEDGE unverified facts: no role/company on file → never assert one.
//   - CHANNEL per-alum: email (subject + greeting) vs LinkedIn (≤280, neither).
//   - SONNET for first-contact intros (the relationship cost of form-mail
//     dwarfs the token delta); Haiku for follow-ups/thank-yous.
//   - Mutual contacts are mentioned ONLY when the student actually met them.

import Anthropic from '@anthropic-ai/sdk'
import { buildUserContext } from '@/lib/ai/user-context'
import {
  connectionNote, factNote, generateOutreach,
  type OutreachChannel, type OutreachTone, type OutreachType,
} from '@/lib/agent/outreach'
import type { Alumni, Profile } from '@scout/shared/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type DraftMessageType = OutreachType
export type DraftChannel = OutreachChannel

/** Decide the channel from what contact info the alum actually has. */
export function channelForAlumni(a: Pick<Alumni, 'email' | 'linkedin_url'>): DraftChannel {
  return a.email ? 'email' : 'linkedin'
}

export async function draftMessage(opts: {
  alumni: Alumni
  profile: Profile
  messageType: DraftMessageType
  channel: DraftChannel
  tone?: OutreachTone
  goalContext?: string
  /** Pass ONLY when the student has genuinely met this contact. */
  mutualNote?: string | null
}): Promise<string> {
  const { alumni, profile, messageType, channel, tone = 'friendly', goalContext, mutualNote } = opts
  const hasRoleCompany = Boolean(alumni.role && alumni.company)

  const recipientLines = [
    `- Name: ${alumni.full_name}`,
    hasRoleCompany ? `- Current role: ${alumni.role} at ${alumni.company}` : null,
    alumni.industry ? `- Industry: ${alumni.industry}` : null,
    alumni.sport ? `- Played ${alumni.sport} at Cornell` : '- Cornell Athletics alum',
    alumni.graduation_year ? `- Class of ${alumni.graduation_year}` : null,
  ].filter(Boolean).join('\n')

  // Sonnet for the first impression to a real person; Haiku for the rest.
  const model = messageType === 'introduction' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'

  return generateOutreach(anthropic, {
    model,
    channel,
    type: messageType,
    tone,
    facts: {
      senderContext: buildUserContext(profile),
      recipientLines,
      connectionNote: connectionNote(profile.sport, alumni.sport),
      factNote: factNote(hasRoleCompany),
      goalContext: goalContext ?? null,
      mutualNote: mutualNote ?? null,
    },
  })
}
