// The single prompt core for ALL outreach drafting — the picks/cron generator
// (draftMessage.ts) and the live /api/generate-message route both build from
// here, so voice and integrity rules can't drift between surfaces again.
//
// Design: stable rules + few-shot examples live in the SYSTEM prompt; the
// per-request sender/recipient data lives in the USER message. Every draft is
// linted (banned phrases, channel limits, placeholders) with one corrective
// retry before it's returned.

import type Anthropic from '@anthropic-ai/sdk'

export type OutreachType = 'introduction' | 'follow_up' | 'thank_you'
export type OutreachChannel = 'email' | 'linkedin'
export type OutreachTone = 'friendly' | 'neutral' | 'formal'

// ── Voice & structure (stable — system prompt) ───────────────────────────────

const VOICE = `You write networking messages for Cornell student-athletes reaching out to Cornell alumni. You write in the student's voice: a real college student — plain, direct, specific. Not a cover letter, not marketing copy.

STRUCTURE (in order):
1. HOOK — one sentence on why THIS alum specifically: their actual role/company, or a true shared background. Never open with flattery or with anything about yourself.
2. WHO + WHY — one sentence: who the student is and what they're working toward.
3. ASK — one small, concrete ask: 15–20 minutes to talk, with a specific angle ("how you broke in", "what you'd do differently"). Never ask for a job, referral, or "any advice you might have."
4. EASY OUT — one short closing line that makes "no" easy ("If this is a busy stretch, no problem at all.").

HARD RULES:
- NEVER use these phrases or close variants: "I hope this finds you well", "I came across your profile", "I stumbled upon", "your journey", "pick your brain", "I was inspired", "really inspiring", "impressive", "resonated with me", "I'd be honored", "I would love the opportunity".
- No flattery openers. The hook states a FACT about them, not an opinion of them.
- Maximum one "I'd love to" per message; prefer "Would you be open to".
- No placeholder brackets, ever. Use the data given or omit gracefully.
- Vary sentence openings; the message must not read as a template.
- Sound human: contractions are fine, exclamation points almost never.`

const HONESTY = `HONESTY — these override everything else:
- Only state facts present in the data provided. If role/company are missing, hedge naturally ("your path since Cornell", "what you've been building") — a vague-but-true line always beats an invented specific.
- A shared sport may be claimed ONLY when the connection note says the sports match. Otherwise "fellow Cornell athlete" is the strongest allowed bond.
- If their title reads as a joke or a cut-off fragment ("People Whisperer"), refer to them by company or industry instead — never quote a junk title.
- Mention a mutual contact ONLY if one is explicitly provided in the data. Never invent or imply one.`

const CHANNEL_RULES: Record<OutreachChannel, string> = {
  linkedin: `CHANNEL: LinkedIn connection note.
- HARD LIMIT 280 characters (LinkedIn cuts at 300; leave margin). Count carefully.
- No greeting, no sign-off — LinkedIn shows who's sending.
- First sentence is the hook. Last sentence is the ask. That's usually all that fits.`,
  email: `CHANNEL: Email.
- First line: "Subject: " followed by a subject of at most 7 words — specific, no clickbait, no "Quick question".
- Then a blank line, then the message.
- Greeting "Hi {their first name}," and sign-off with the student's first name only.
- Body: 80–130 words. Shorter is better. Busy people reply to short emails.`,
}

const TYPE_RULES: Record<OutreachType, string> = {
  introduction: 'TYPE: First outreach. Follow the four-part structure exactly.',
  follow_up: 'TYPE: One gentle follow-up after no reply. It MUST open by acknowledging the earlier note ("Following up on my note from a couple weeks back —"). Then one NEW specific reason or detail (not a repeat of the first hook), then the same small ask. Two or three sentences total. Zero guilt, zero pressure.',
  thank_you: 'TYPE: Thank-you after a real conversation. Reference one or two specific things discussed (from the context given), state what the student is doing next because of it, offer to keep them posted. No new asks.',
}

const TONE_RULES: Record<OutreachTone, string> = {
  friendly: 'TONE: Warm and natural — how you would talk to a teammate\'s older sibling.',
  neutral: 'TONE: Professional but human. Clear and respectful without stiffness.',
  formal: 'TONE: Polished and businesslike. Full sentences, no slang, still concise.',
}

// Few-shot examples — the strongest lever for voice. One per channel, written
// to also demonstrate hedging (the email example has no shared sport and shows
// a fellow-athlete bond done honestly).
const EXAMPLES: Record<OutreachChannel, string> = {
  email: `EXAMPLE (email, different sports, role/company known — note the hedge-free hook, tight body, easy out):
Subject: Cornell lacrosse junior, aiming for consulting

Hi Sarah,

You run ops strategy at Deloitte, which is exactly the work I'm trying to understand before recruiting season. I'm a junior on the lacrosse team at Cornell, headed into consulting interviews this fall.

Would you be open to 15 minutes in the next few weeks? I'd bring three specific questions about how you chose strategy over implementation work — not a resume walk-through.

If this lands during a crunch, no problem at all.

Best,
Maya`,
  linkedin: `EXAMPLE (LinkedIn, same sport, 240 chars — hook, who+why, ask, compressed):
Fellow Cornell wrestler here ('26). Your move from the team to leveraged finance at Citi is the path I'm working toward. Open to 15 minutes sometime? I have specific questions, not a pitch. No worries if you're slammed.`,
}

// ── Builders ─────────────────────────────────────────────────────────────────

export function buildOutreachSystem(channel: OutreachChannel, type: OutreachType, tone: OutreachTone = 'friendly'): string {
  return [VOICE, HONESTY, CHANNEL_RULES[channel], TYPE_RULES[type], TONE_RULES[tone], EXAMPLES[channel],
    'Output ONLY the message (including the Subject line for email). No commentary, no options, no quotation marks around the message.',
  ].join('\n\n')
}

export interface OutreachFacts {
  senderContext: string          // buildUserContext(profile)
  recipientLines: string         // verified recipient facts, one per line
  connectionNote: string         // sport-match verdict (see connectionNote())
  factNote: string               // role/company availability (see factNote())
  goalContext?: string | null    // e.g. "working toward informational interviews in Finance"
  mutualNote?: string | null     // ONLY when the student truly knows someone (see mutualNote())
  extraContext?: string | null   // e.g. thank-you call notes
}

export function buildOutreachUser(f: OutreachFacts): string {
  return [
    `SENDER (student):\n${f.senderContext}`,
    `RECIPIENT (verified facts — use nothing beyond these):\n${f.recipientLines}`,
    `CONNECTION: ${f.connectionNote}`,
    `FACTS AVAILABLE: ${f.factNote}`,
    f.goalContext ? `STUDENT'S GOAL: ${f.goalContext}` : null,
    f.mutualNote ? `MUTUAL CONTACT (real, may be mentioned naturally): ${f.mutualNote}` : null,
    f.extraContext ? `CONTEXT: ${f.extraContext}` : null,
    'Write the message.',
  ].filter(Boolean).join('\n\n')
}

export function connectionNote(studentSport: string | null | undefined, alumSport: string | null | undefined): string {
  const matched = Boolean(studentSport && alumSport && studentSport.toLowerCase() === alumSport.toLowerCase())
  return matched
    ? `Both played ${alumSport} at Cornell — the shared-sport tie is real and may lead the hook.`
    : `Different sports (student: ${studentSport ?? 'unknown'}; alum: ${alumSport ?? 'unknown'}). "Fellow Cornell athlete" is allowed; claiming the same sport is NOT.`
}

export function factNote(hasRoleCompany: boolean): string {
  return hasRoleCompany
    ? 'Role and company are on file — the hook should use them specifically (unless the title is a non-literal fragment; then use company/industry).'
    : 'Role/company NOT on file. Do not assert any employer, title, or specific fact. Hedge naturally.'
}

/** Build the mutual-contact line — call ONLY for contacts the student has actually met. */
export function mutualNote(name: string, detail?: string | null): string {
  return `The student knows ${name}${detail ? ` (${detail})` : ''} and has genuinely talked with them. Allowed: "I've been talking with ${name}" plus the factual detail given (e.g. that ${name} played with the recipient). NOT allowed: any claim about what was said or who brought whom up ("your name came up", "${name} mentioned you", referred/recommended/suggested/pointed) — none of that is known. The connection is simply: the student knows ${name}; ${name} knows the recipient.`
}

// ── Lint + corrective retry ──────────────────────────────────────────────────

const BANNED = [
  'i hope this finds you well', 'i came across', 'i stumbled', 'your journey',
  'pick your brain', 'inspired', 'inspiring', 'impressive', 'resonated',
  'i\'d be honored', 'i would be honored', 'i would love the opportunity',
]

export function lintOutreach(draft: string, channel: OutreachChannel, type: OutreachType = 'introduction'): string[] {
  const issues: string[] = []
  const lower = draft.toLowerCase()
  if (type === 'follow_up' && !/(follow|circling back|my (earlier|last|previous|first) (note|message|email)|wanted to bump)/.test(lower)) {
    issues.push('a follow-up must open by acknowledging the earlier note ("Following up on my note from a couple weeks back —")')
  }
  for (const phrase of BANNED) {
    if (lower.includes(phrase)) issues.push(`remove the phrase "${phrase}" (banned — rewrite that thought specifically)`)
  }
  if (/\[[^\]]{1,40}\]/.test(draft)) issues.push('remove placeholder brackets — use real data or omit')
  if (channel === 'linkedin') {
    if (draft.length > 280) issues.push(`shorten to under 280 characters (currently ${draft.length})`)
    if (/^(hi|hello|hey|dear)\b/i.test(draft.trim())) issues.push('remove the greeting — LinkedIn notes have none')
  }
  if (channel === 'email' && !/^subject:/i.test(draft.trim())) {
    issues.push('start with a "Subject: " line (max 7 words)')
  }
  return issues
}

/** Generate with one corrective retry when the lint finds violations. */
export async function generateOutreach(
  anthropic: Anthropic,
  opts: { model: string; channel: OutreachChannel; type: OutreachType; tone?: OutreachTone; facts: OutreachFacts }
): Promise<string> {
  const system = buildOutreachSystem(opts.channel, opts.type, opts.tone)
  const userMsg = buildOutreachUser(opts.facts)

  const first = await anthropic.messages.create({
    model: opts.model,
    max_tokens: 600,
    system,
    messages: [{ role: 'user', content: userMsg }],
  })
  let draft = first.content[0]?.type === 'text' ? first.content[0].text.trim() : ''

  const issues = lintOutreach(draft, opts.channel, opts.type)
  if (issues.length && draft) {
    const retry = await anthropic.messages.create({
      model: opts.model,
      max_tokens: 600,
      system,
      messages: [
        { role: 'user', content: userMsg },
        { role: 'assistant', content: draft },
        { role: 'user', content: `Revise the message. Keep what works, but fix these problems:\n- ${issues.join('\n- ')}\n\nOutput only the revised message.` },
      ],
    })
    const revised = retry.content[0]?.type === 'text' ? retry.content[0].text.trim() : ''
    if (revised) draft = revised
  }
  return draft
}
