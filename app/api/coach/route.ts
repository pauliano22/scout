import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface Alumni {
  id: string
  full_name: string
  company?: string
  role?: string
  industry?: string
  sport?: string
  graduation_year?: number
  location?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { interest, userProfile, relevantAlumni } = body

    if (!interest) {
      return NextResponse.json(
        { error: 'Missing career interest' },
        { status: 400 }
      )
    }

    // Format alumni for the prompt
    const alumniList = (relevantAlumni || []).slice(0, 6).map((a: Alumni, i: number) => 
      `${i + 1}. ${a.full_name} - ${a.role || 'Role unknown'} at ${a.company || 'Company unknown'} (${a.sport || 'Cornell Athletics'}, ${a.graduation_year || 'Year unknown'})`
    ).join('\n')

    const prompt = `You are a career coach for Cornell student-athletes. Generate a personalized action plan for a student interested in ${interest}.

STUDENT INFO:
- Name: ${userProfile?.name || 'Student'}
- Sport: ${userProfile?.sport || 'Cornell Athletics'}
- Graduation Year: ${userProfile?.graduationYear || 'Current student'}
- Interests: ${userProfile?.interests || interest}

RELEVANT CORNELL ATHLETE ALUMNI IN DATABASE:
${alumniList || 'No specific alumni matches found'}

Generate a JSON response with this exact structure:
{
  "shortTermActions": [
    {"text": "Action item 1 (specific, actionable, for this week)", "priority": "high"},
    {"text": "Action item 2", "priority": "medium"},
    {"text": "Action item 3", "priority": "medium"},
    {"text": "Action item 4", "priority": "low"},
    {"text": "Action item 5", "priority": "low"}
  ],
  "longTermActions": [
    {"text": "Action item 1 (for next 2-3 months)", "priority": "high"},
    {"text": "Action item 2", "priority": "medium"},
    {"text": "Action item 3", "priority": "medium"},
    {"text": "Action item 4", "priority": "low"}
  ],
  "alumniRecommendations": [
    {"alumniName": "Name from list above", "reason": "Personalized 1-sentence reason why they should connect"},
    ...for each relevant alumni
  ],
  "keyInsight": "One motivational or strategic insight specific to ${interest} and being a student-athlete"
}

REQUIREMENTS:
- Short-term actions should be completable within 1-2 weeks
- Long-term actions should be 1-3 month goals
- Be specific to ${interest}, not generic career advice
- Reference the student's sport background as an advantage where relevant
- Alumni recommendations should explain the specific connection opportunity
- If alumni work at dream companies for ${interest}, highlight that
- Keep action items concise but specific

Return ONLY valid JSON, no other text.`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
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
      // Try to extract JSON if there's extra text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText
      const plan = JSON.parse(jsonStr)
      
      return NextResponse.json(plan)
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse response', raw: responseText },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error generating career plan:', error)
    return NextResponse.json(
      { error: 'Failed to generate career plan' },
      { status: 500 }
    )
  }
}