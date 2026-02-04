import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createCalendarEventPayload } from '@/lib/smart-links'

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

      // Try to save suggested actions for top alumni recommendations (non-blocking)
      const suggestedActions: unknown[] = []
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user && plan.alumniRecommendations && relevantAlumni) {
          // Create calendar event suggestions for top 3 recommended alumni
          const topRecommendations = plan.alumniRecommendations.slice(0, 3)

          for (const rec of topRecommendations) {
            // Find the matching alumni from the original list
            const alumni = relevantAlumni.find(
              (a: Alumni) => a.full_name === rec.alumniName
            )

            if (alumni) {
              // Create a calendar event suggestion for coffee chat
              const calendarPayload = createCalendarEventPayload(
                `Coffee Chat with ${alumni.full_name}`,
                {
                  description: `${rec.reason}\n\nCompany: ${alumni.company || 'N/A'}\nRole: ${alumni.role || 'N/A'}`,
                  location: 'Zoom / Phone Call',
                }
              )

              const { data: action } = await supabase
                .from('suggested_actions')
                .insert({
                  user_id: user.id,
                  alumni_id: alumni.id || null,
                  action_type: 'calendar_event',
                  payload: calendarPayload,
                  ai_reasoning: rec.reason,
                  confidence_score: 0.8,
                  status: 'pending',
                })
                .select()
                .single()

              if (action) {
                suggestedActions.push(action)
              }
            }
          }
        }
      } catch (actionError) {
        // Don't fail the request if action saving fails
        console.error('Failed to save suggested actions:', actionError)
      }

      return NextResponse.json({
        ...plan,
        suggestedActions,
      })
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