import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ActionItem {
  text: string
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { interest, userProfile, completedActions, remainingActions } = body

    if (!interest) {
      return NextResponse.json(
        { error: 'Missing career interest' },
        { status: 400 }
      )
    }

    // Format completed and remaining actions for context
    const completedList = (completedActions || [])
      .map((a: ActionItem, i: number) => `${i + 1}. ${a.text}`)
      .join('\n')

    const remainingList = (remainingActions || [])
      .map((a: ActionItem, i: number) => `${i + 1}. ${a.text}`)
      .join('\n')

    const prompt = `You are a career coach for Cornell student-athletes. Generate 4-6 NEW follow-up action items for a student who has made progress on their ${interest} career plan.

STUDENT INFO:
- Name: ${userProfile?.name || 'Student'}
- Sport: ${userProfile?.sport || 'Cornell Athletics'}
- Graduation Year: ${userProfile?.graduationYear || 'Current student'}
- Career Interest: ${interest}

COMPLETED ACTIONS:
${completedList || 'None yet'}

REMAINING ACTIONS:
${remainingList || 'All completed'}

Generate NEW action items that:
1. Build on completed actions (e.g., if they updated their resume, next step might be to apply to specific positions)
2. Are more advanced than remaining items
3. Are specific to ${interest}
4. Include networking, skill-building, or application-related tasks

Return a JSON response with this exact structure:
{
  "nextSteps": [
    {"text": "Specific action item 1", "priority": "high"},
    {"text": "Specific action item 2", "priority": "medium"},
    {"text": "Specific action item 3", "priority": "medium"},
    {"text": "Specific action item 4", "priority": "low"}
  ]
}

REQUIREMENTS:
- Generate 4-6 NEW action items not in the remaining list
- Make them progressively more advanced based on progress
- Include at least one networking action and one application/skill action
- Keep items concise but specific
- If student has completed networking tasks, suggest deeper engagement (coffee chats, follow-ups)
- If student has completed prep tasks, suggest actual applications

Return ONLY valid JSON, no other text.`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Extract text from response
    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : ''

    // Parse JSON from response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText
      const result = JSON.parse(jsonStr)

      // Ensure all items have completed: false
      const nextSteps = (result.nextSteps || []).map((item: any) => ({
        text: item.text,
        priority: item.priority || 'medium',
        completed: false,
      }))

      return NextResponse.json({ nextSteps })
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse response', raw: responseText },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error generating next steps:', error)
    return NextResponse.json(
      { error: 'Failed to generate next steps' },
      { status: 500 }
    )
  }
}
