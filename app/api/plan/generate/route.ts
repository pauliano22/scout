import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

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

    const prompt = `You are a career networking advisor for a Cornell student-athlete. Based on the student's profile and goals, select the top ${batchSize} alumni from the list below and generate personalized content for each.

STUDENT PROFILE:
- Name: ${profile.full_name || 'Student'}
- Sport: ${profile.sport || 'N/A'}
- Major: ${profile.major || 'N/A'}
- Primary Industry Interest: ${profile.primary_industry || 'Open to all'}
- Target Roles: ${profile.target_roles?.join(', ') || 'Open to all'}
- Secondary Industries: ${profile.secondary_industries?.join(', ') || 'None'}
- Current Stage: ${profile.current_stage || 'exploring'}
- Past Experience: ${profile.past_experience || 'None listed'}
- Location Preference: ${profile.geography_preference || 'doesnt_matter'}${profile.preferred_locations?.length ? ' (' + profile.preferred_locations.join(', ') + ')' : ''}

AVAILABLE ALUMNI:
${alumniList}

For each selected alumnus, respond in this exact JSON format:
{
  "recommendations": [
    {
      "index": <number from the list above>,
      "career_summary": "<2-3 sentence summary of their career path and what makes them valuable to connect with>",
      "talking_points": ["<point 1>", "<point 2>", "<point 3>"],
      "recommendation_reason": "<1 sentence explaining why this person is a great match for the student>"
    }
  ]
}

Select the ${batchSize} most relevant alumni. Prioritize those in the student's target industries and roles. Generate unique, specific talking points based on each person's actual company and role. Do NOT use generic advice. Respond ONLY with valid JSON.`

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

    // Insert plan_alumni rows
    const planAlumniRows = recommendations.map((rec: any, i: number) => {
      const alumnus = candidates[rec.index - 1]
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
