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

    const { planId, count = 5 } = await request.json()

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID required' }, { status: 400 })
    }

    // Verify plan ownership
    const { data: plan } = await supabase
      .from('networking_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get already-recommended alumni IDs
    const { data: existingPlanAlumni } = await supabase
      .from('plan_alumni')
      .select('alumni_id')
      .eq('plan_id', planId)

    const { data: existingNetworkIds } = await supabase
      .from('user_networks')
      .select('alumni_id')
      .eq('user_id', user.id)

    const excludeIds = new Set([
      ...(existingPlanAlumni?.map(pa => pa.alumni_id) || []),
      ...(existingNetworkIds?.map(n => n.alumni_id) || []),
    ])

    // Fetch available alumni
    const { data: allAlumni } = await supabase
      .from('alumni')
      .select('id, full_name, company, role, industry, sport, graduation_year, location, linkedin_url, email')
      .eq('is_public', true)
      .not('company', 'is', null)
      .limit(5000)

    const availableAlumni = (allAlumni || []).filter(a => !excludeIds.has(a.id))

    if (availableAlumni.length === 0) {
      return NextResponse.json({ error: 'No new alumni available' }, { status: 404 })
    }

    // Score and sort
    const scoredAlumni = availableAlumni.map(a => {
      let score = 0
      if (profile.primary_industry && a.industry?.toLowerCase() === profile.primary_industry.toLowerCase()) score += 3
      if (profile.secondary_industries?.some((si: string) => a.industry?.toLowerCase() === si.toLowerCase())) score += 1
      if (profile.preferred_locations?.some((loc: string) => a.location?.toLowerCase().includes(loc.toLowerCase()))) score += 2
      if (profile.sport && a.sport?.toLowerCase() === profile.sport.toLowerCase()) score += 1
      return { ...a, score }
    }).sort((a, b) => b.score - a.score)

    const candidates = scoredAlumni.slice(0, Math.min(count * 3, scoredAlumni.length))

    const alumniList = candidates.map((a, i) =>
      `${i + 1}. ${a.full_name} | ${a.role || 'N/A'} @ ${a.company || 'N/A'} | ${a.industry || 'N/A'} | ${a.sport} '${a.graduation_year} | ${a.location || 'N/A'}`
    ).join('\n')

    const prompt = `You are a career networking advisor for a Cornell student-athlete. Select the top ${count} alumni and generate personalized content for each.

STUDENT PROFILE:
- Name: ${profile.full_name || 'Student'}
- Sport: ${profile.sport || 'N/A'}
- Major: ${profile.major || 'N/A'}
- Primary Industry Interest: ${profile.primary_industry || 'Open to all'}
- Target Roles: ${profile.target_roles?.join(', ') || 'Open to all'}
- Current Stage: ${profile.current_stage || 'exploring'}
- Past Experience: ${profile.past_experience || 'None listed'}

AVAILABLE ALUMNI:
${alumniList}

Respond in this exact JSON format:
{
  "recommendations": [
    {
      "index": <number from list>,
      "career_summary": "<2-3 sentence summary>",
      "talking_points": ["<point 1>", "<point 2>", "<point 3>"],
      "recommendation_reason": "<1 sentence why this person is a great match>"
    }
  ]
}

Respond ONLY with valid JSON.`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let recommendations
    try {
      const parsed = JSON.parse(responseText)
      recommendations = parsed.recommendations
    } catch {
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

    // Get current max sort_order
    const { data: maxSortRow } = await supabase
      .from('plan_alumni')
      .select('sort_order')
      .eq('plan_id', planId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const startOrder = (maxSortRow?.sort_order || 0) + 1

    const planAlumniRows = recommendations.map((rec: any, i: number) => {
      const alumnus = candidates[rec.index - 1]
      if (!alumnus) return null
      return {
        plan_id: planId,
        alumni_id: alumnus.id,
        ai_career_summary: rec.career_summary,
        ai_talking_points: rec.talking_points,
        ai_recommendation_reason: rec.recommendation_reason,
        status: 'active',
        sort_order: startOrder + i,
      }
    }).filter(Boolean)

    const { data: newPlanAlumni, error: insertError } = await supabase
      .from('plan_alumni')
      .insert(planAlumniRows)
      .select(`
        *,
        alumni (*)
      `)

    if (insertError) {
      console.error('Failed to insert plan alumni:', insertError)
      return NextResponse.json({ error: 'Failed to save recommendations' }, { status: 500 })
    }

    return NextResponse.json({ planAlumni: newPlanAlumni })
  } catch (error) {
    console.error('Generate more error:', error)
    return NextResponse.json({ error: 'Failed to generate more recommendations' }, { status: 500 })
  }
}
