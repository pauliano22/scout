import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { alumni, userName, userSport, userInterests, tone, messageType = 'introduction' } = body

    // Validate required fields
    if (!alumni || !tone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
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

SENDER INFO:
- Name: ${userName || '[Student Name]'}
- Sport: ${userSport || '[Sport]'}
- Interests: ${userInterests || 'career opportunities'}

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
- Be authentic, not generic
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

    // Extract text from response
    const generatedMessage = message.content[0].type === 'text'
      ? message.content[0].text
      : ''

    // Try to save as a suggested action (non-blocking)
    let suggestedAction = null
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Create email draft payload
        const emailPayload = {
          recipientEmail: alumni.email || '',
          recipientName: alumni.full_name,
          subject: `Cornell ${userSport || 'Athlete'} Reaching Out`,
          body: generatedMessage,
        }

        // Save the suggested action
        const { data: action } = await supabase
          .from('suggested_actions')
          .insert({
            user_id: user.id,
            alumni_id: alumni.id || null,
            action_type: 'email_draft',
            payload: emailPayload,
            ai_reasoning: `Draft message to connect with ${alumni.full_name} at ${alumni.company || 'their company'}`,
            confidence_score: 0.85,
            status: 'pending',
          })
          .select()
          .single()

        suggestedAction = action
      }
    } catch (actionError) {
      // Don't fail the request if action saving fails
      console.error('Failed to save suggested action:', actionError)
    }

    return NextResponse.json({
      message: generatedMessage,
      suggestedAction,
    })
  } catch (error) {
    console.error('Error generating message:', error)
    return NextResponse.json(
      { error: 'Failed to generate message' },
      { status: 500 }
    )
  }
}