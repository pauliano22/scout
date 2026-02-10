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

    const { batchSize = 10 } = await request.json()

    // Fetch user profile with intake data
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Fetch alumni that the user hasn't already been recommended
    const { data: existingNetworkIds } = await supabase
      .from('user_networks')
      .select('alumni_id')
      .eq('user_id', user.id)

    const excludeIds = new Set(existingNetworkIds?.map(n => n.alumni_id) || [])

    // Fetch available alumni
    const { data: allAlumni } = await supabase
      .from('alumni')
      .select('id, full_name, company, role, industry, sport, graduation_year, location, linkedin_url, email')
      .eq('is_public', true)
      .not('company', 'is', null)
      .limit(5000)

    if (!allAlumni || allAlumni.length === 0) {
      return NextResponse.json({ error: 'No alumni available' }, { status: 404 })
    }

    // Filter out already-connected alumni
    const availableAlumni = allAlumni.filter(a => !excludeIds.has(a.id))

    if (availableAlumni.length === 0) {
      return NextResponse.json({ error: 'No new alumni available' }, { status: 404 })
    }

    // Pre-filter alumni by relevance (industry, location)
    const scoredAlumni = availableAlumni.map(a => {
      let score = 0
      if (profile.primary_industry && a.industry?.toLowerCase() === profile.primary_industry.toLowerCase()) score += 3
      if (profile.secondary_industries?.some((si: string) => a.industry?.toLowerCase() === si.toLowerCase())) score += 1
      if (profile.preferred_locations?.some((loc: string) => a.location?.toLowerCase().includes(loc.toLowerCase()))) score += 2
      if (profile.sport && a.sport?.toLowerCase() === profile.sport.toLowerCase()) score += 1
      return { ...a, score }
    }).sort((a, b) => b.score - a.score)

    // Take top candidates for AI selection
    const candidates = scoredAlumni.slice(0, Math.min(batchSize * 3, scoredAlumni.length))

    // Build the AI prompt
    const alumniList = candidates.map((a, i) =>
      `${i + 1}. ${a.full_name} | ${a.role || 'N/A'} @ ${a.company || 'N/A'} | ${a.industry || 'N/A'} | ${a.sport} '${a.graduation_year} | ${a.location || 'N/A'}`
    ).join('\n')

    const prompt = `You are helping a Cornell student-athlete prepare for networking conversations with alumni. Based on the student's profile, select the top ${batchSize} alumni from the list below and generate content to help the student have a great conversation with each person.

STUDENT PROFILE:
${buildUserContext(profile)}

AVAILABLE ALUMNI:
${alumniList}

For each selected alumnus, respond in this exact JSON format:
{
  "recommendations": [
    {
      "index": <number from the list above>,
      "full_name": "<exact full name from the list>",
      "career_summary": "<2-3 sentence summary of their career path and what makes them valuable to connect with>",
      "talking_points": ["<point 1>", "<point 2>", "<point 3>"],
      "recommendation_reason": "<1 sentence explaining why this person is a great match for the student>"
    }
  ]
}

IMPORTANT: The "full_name" must EXACTLY match the name from the list, and the "index" must be the correct number for that person. Double-check that your content (career_summary, talking_points, recommendation_reason) is about the person named in "full_name".

Select the ${batchSize} most relevant alumni. Prioritize those in the student's target industries and roles.

TALKING POINTS INSTRUCTIONS:
Talking points are conversation topics the student can bring up when they meet this person. Each one should be a specific question or topic they could naturally ask about during a coffee chat or call. Think about what would make for an interesting, genuine conversation between these two people.

Good talking points reference the person's specific company, role, or industry and connect to the student's background. For example:
- "What the day-to-day looks like as a ${'{role}'} at ${'{company}'} — and how it compares to what you expected going in"
- "How they made the jump from ${'{previous industry/role}'} to ${'{current role}'} — especially useful since you're considering a similar path"
- "What they wish they'd known about ${'{industry}'} before starting, given your ${'{major}'} background"
- "Their experience balancing the transition from D1 athletics into early career — and whether the discipline/time management skills actually translated the way people say"

Do NOT write vague or buzzword-heavy points like "discuss leadership synergies" or "explore industry trends." Write like a friend giving you advice on what to actually ask someone.

Respond ONLY with valid JSON.`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let recommendations
    try {
      const parsed = JSON.parse(responseText)
      recommendations = parsed.recommendations
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        recommendations = parsed.recommendations
      } else {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
      }
    }

    if (!recommendations || recommendations.length === 0) {
      return NextResponse.json({ error: 'No recommendations generated' }, { status: 500 })
    }

    // Deactivate any existing active plans
    await supabase
      .from('networking_plans')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true)

    // Create the networking plan
    const goalCount = profile.networking_intensity === '20' ? 20
      : profile.networking_intensity === '10' ? 10
      : profile.networking_intensity === '5' ? 5
      : 10

    const { data: plan, error: planError } = await supabase
      .from('networking_plans')
      .insert({
        user_id: user.id,
        title: `${profile.primary_industry || 'Networking'} Plan`,
        goal_count: goalCount,
        is_active: true,
      })
      .select()
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
    }

    // Insert plan_alumni rows - match by name first, fall back to index
    const planAlumniRows = recommendations.map((rec: any, i: number) => {
      let alumnus = rec.full_name
        ? candidates.find(c => c.full_name?.toLowerCase() === rec.full_name.toLowerCase())
        : null
      if (!alumnus) {
        alumnus = candidates[rec.index - 1] || null
      }
      if (!alumnus) return null
      return {
        plan_id: plan.id,
        alumni_id: alumnus.id,
        ai_career_summary: rec.career_summary,
        ai_talking_points: rec.talking_points,
        ai_recommendation_reason: rec.recommendation_reason,
        status: 'active',
        sort_order: i,
      }
    }).filter(Boolean)

    const { error: insertError } = await supabase
      .from('plan_alumni')
      .insert(planAlumniRows)

    if (insertError) {
      console.error('Failed to insert plan alumni:', insertError)
      return NextResponse.json({ error: 'Failed to save recommendations' }, { status: 500 })
    }

    // Fetch the complete plan with alumni data
    const { data: completePlan } = await supabase
      .from('networking_plans')
      .select(`
        *,
        plan_alumni (
          *,
          alumni (*)
        )
      `)
      .eq('id', plan.id)
      .single()

    return NextResponse.json({ plan: completePlan })
  } catch (error) {
    console.error('Plan generation error:', error)
    return NextResponse.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
