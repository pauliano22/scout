// POST /api/generate-message — live draft generation for the message modal
// (web) and the mobile generate flow. Built on the SAME prompt core as the
// agent's pick drafts (lib/agent/outreach.ts): one voice, one set of integrity
// rules (no fabricated shared sports, no invented employers, no canned spam),
// one lint. Intros use Sonnet — the first impression to a real alum is worth
// the token delta; follow-ups and thank-yous use Haiku.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildUserContext } from '@/lib/ai/user-context'
import {
  buildOutreachUser, buildOutreachSystem, connectionNote, factNote, generateOutreach,
  type OutreachChannel, type OutreachTone, type OutreachType,
} from '@/lib/agent/outreach'
import {
  checkRateLimit,
  addRateLimitHeaders,
  rateLimitExceeded,
} from '@/lib/rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TYPES: OutreachType[] = ['introduction', 'follow_up', 'thank_you']
const TONES: OutreachTone[] = ['friendly', 'neutral', 'formal']

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limit: authenticated tier (100 req/min) keyed by user ID ──
  const rl = checkRateLimit(`generate-message:${user.id}`, 'authenticated')
  if (!rl.success) return rateLimitExceeded(rl)

  try {

    const body = await request.json()
    const { alumni, tone, messageType = 'introduction', platform = 'linkedin', context } = body
    if (!alumni) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const type: OutreachType = TYPES.includes(messageType) ? messageType : 'introduction'
    const channel: OutreachChannel = platform === 'email' ? 'email' : 'linkedin'
    const safeTone: OutreachTone = TONES.includes(tone) ? tone : 'friendly'

    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const hasRoleCompany = Boolean(alumni.role && alumni.company)
    const recipientLines = [
      `- Name: ${alumni.full_name}`,
      hasRoleCompany ? `- Current role: ${alumni.role} at ${alumni.company}` : null,
      alumni.industry ? `- Industry: ${alumni.industry}` : null,
      alumni.sport ? `- Played ${alumni.sport} at Cornell` : '- Cornell Athletics alum',
      alumni.graduation_year ? `- Class of ${alumni.graduation_year}` : null,
    ].filter(Boolean).join('\n')

    const generatedMessage = await generateOutreach(anthropic, {
      model: type === 'introduction' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001',
      channel,
      type,
      tone: safeTone,
      facts: {
        senderContext: buildUserContext(profile),
        recipientLines,
        connectionNote: connectionNote(profile.sport, alumni.sport),
        factNote: factNote(hasRoleCompany),
        // Thank-yous reference what was actually discussed, when the client sends it
        extraContext: typeof context === 'string' && context.trim() ? context.trim().slice(0, 600) : null,
      },
    })

    return addRateLimitHeaders(NextResponse.json({ message: generatedMessage }), rl)
  } catch (error) {
    console.error('Error generating message:', error)
    return addRateLimitHeaders(NextResponse.json({ error: 'Failed to generate message' }, { status: 500 }), rl)
  }
}
