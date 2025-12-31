import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { alumni, userName, userSport, userInterests, tone } = body

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

    const prompt = `Generate a networking outreach message from a current Cornell student-athlete to a Cornell alumni.

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

REQUIREMENTS:
- Keep it concise (150-200 words max)
- Mention the shared Cornell Athletics connection
- Reference their specific company/role
- Ask for a brief call or coffee chat
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

    return NextResponse.json({ message: generatedMessage })
  } catch (error) {
    console.error('Error generating message:', error)
    return NextResponse.json(
      { error: 'Failed to generate message' },
      { status: 500 }
    )
  }
}