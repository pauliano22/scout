import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildUserContext } from '@/lib/ai/user-context'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { alumni, tone, messageType = 'introduction' } = body

    if (!alumni || !tone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Fetch full profile so Claude has complete context
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const toneInstructions = {
      friendly: 'Write in a warm, casual, and enthusiastic tone. Use conversational language and show genuine excitement. Feel free to use exclamation points sparingly.',
      neutral: 'Write in a professional but approachable tone. Balance warmth with professionalism. Be respectful and clear.',
      formal: 'Write in a formal, professional tone. Be polished and business-like. Use proper salutations and maintain a respectful distance.',
    }

    const messageTypeInstructions = {
      introduction: {
        purpose: 'This is a FIRST OUTREACH message to introduce yourself and request to connect.',
        requirements: `- Mention the shared Cornell Athletics connection
- Reference their specific company/role
- Ask for a brief call or coffee chat
- Express genuine interest in learning from their experience`,
      },
      follow_up: {
        purpose: 'This is a FOLLOW-UP message after initial contact (they may not have responded yet, or you want to continue the conversation).',
        requirements: `- Reference your previous outreach briefly
- Don't be pushy - be understanding of their busy schedule
- Offer flexible timing for a call
- Keep it shorter than an intro message (100-150 words)`,
      },
      thank_you: {
        purpose: 'This is a THANK YOU message after having a call or meeting with them.',
        requirements: `- Express genuine gratitude for their time
- Reference 1-2 specific insights or advice they shared
- Mention any next steps you discussed
- Offer to stay in touch or provide updates on your progress
- Keep it concise (100-150 words)`,
      },
    }

    const typeConfig = messageTypeInstructions[messageType as keyof typeof messageTypeInstructions] || messageTypeInstructions.introduction

    const prompt = `Generate a networking message from a current Cornell student-athlete to a Cornell alumni.

MESSAGE TYPE: ${messageType.toUpperCase().replace('_', ' ')}
${typeConfig.purpose}

SENDER (STUDENT) PROFILE:
${buildUserContext(profile)}

RECIPIENT INFO:
- Name: ${alumni.full_name}
- Company: ${alumni.company || 'their company'}
- Role: ${alumni.role || 'their role'}
- Industry: ${alumni.industry || 'their industry'}
- Sport at Cornell: ${alumni.sport || 'Cornell Athletics'}
- Graduation Year: ${alumni.graduation_year || 'Cornell alum'}

TONE: ${tone}
${toneInstructions[tone as keyof typeof toneInstructions]}

SPECIFIC REQUIREMENTS FOR THIS MESSAGE TYPE:
${typeConfig.requirements}

GENERAL REQUIREMENTS:
- Be authentic, not generic — use the student's specific background, experience, and goals to make the message feel personal
- If the student is exploring careers, the message should reflect curiosity; if they're actively recruiting, it should be more direct about what they're looking for
- Reference specific shared connections (same sport, same industry interest, same location) naturally
- Do NOT use placeholder brackets like [Your Name] - use the actual info provided or omit
- End with a simple sign-off using the sender's first name only
- Make each message unique - vary the opening, structure, and specific details

Write only the message, no additional commentary.`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const generatedMessage = message.content[0].type === 'text'
      ? message.content[0].text
      : ''

    return NextResponse.json({
      message: generatedMessage,
    })
  } catch (error) {
    console.error('Error generating message:', error)
    return NextResponse.json(
      { error: 'Failed to generate message' },
      { status: 500 }
    )
  }
}
