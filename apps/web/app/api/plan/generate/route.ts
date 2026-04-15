import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildUserContext } from '@/lib/ai/user-context'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Completeness scoring helpers (additive only — does not change filtering logic)
const GARBAGE = new Set(['...', '-', '--', 'n/a', 'na', 'none', 'unknown', 'null'])
const hasValue = (v: string | null | undefined) =>
  !!v && !GARBAGE.has(v.trim().toLowerCase())

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { batchSize = 10 } = await request.json()

    // ── Profile ───────────────────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('[plan/generate] profile fetch error:', profileError)
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // ── Already-connected alumni ───────────────────────────────────────────────
    const { data: existingNetworkIds } = await supabase
      .from('user_networks')
      .select('alumni_id')
      .eq('user_id', user.id)

    const excludeIds = new Set(existingNetworkIds?.map(n => n.alumni_id) || [])

    // ── Alumni pool — keep the working live filter (.not company is null) ──────
    const { data: allAlumni, error: alumniError } = await supabase
      .from('alumni')
      .select('id, full_name, company, role, industry, sport, graduation_year, location, linkedin_url, email, photo_url, avatar_url')
      .eq('is_public', true)
      .not('company', 'is', null)
      .limit(5000)

    if (alumniError) {
      console.error('[plan/generate] alumni fetch error:', alumniError)
      return NextResponse.json({ error: 'Failed to fetch alumni' }, { status: 500 })
    }

    if (!allAlumni || allAlumni.length === 0) {
      return NextResponse.json({ error: 'No alumni available' }, { status: 404 })
    }

    const availableAlumni = allAlumni.filter(a => !excludeIds.has(a.id))

    if (availableAlumni.length === 0) {
      return NextResponse.json({ error: 'No new alumni available' }, { status: 404 })
    }

    // ── Score by relevance + completeness ─────────────────────────────────────
    const scoredAlumni = availableAlumni.map(a => {
      let score = 0

      // Relevance (original live logic)
      if (profile.primary_industry && a.industry?.toLowerCase() === profile.primary_industry.toLowerCase()) score += 3
      if (profile.secondary_industries?.some((si: string) => a.industry?.toLowerCase() === si.toLowerCase())) score += 1
      if (profile.preferred_locations?.some((loc: string) => a.location?.toLowerCase().includes(loc.toLowerCase()))) score += 2
      if (profile.sport && a.sport?.toLowerCase() === profile.sport.toLowerCase()) score += 1

      // Completeness bonus (additive, does not drop anyone from pool)
      // Only avatar_url earns the photo bonus — it's manually uploaded and always a real headshot.
      // photo_url is scraped from LinkedIn and may be a generic silhouette.
      if (a.avatar_url) score += 3
      if (hasValue(a.role)) score += 2
      if (hasValue(a.company)) score += 2
      if (hasValue(a.location)) score += 1

      return { ...a, score }
    }).sort((a, b) => b.score - a.score)

    const candidates = scoredAlumni.slice(0, Math.min(batchSize * 3, scoredAlumni.length))

    // ── Prompt — restored to the working live version exactly ─────────────────
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
      "company_bio": "<2-3 sentences about the company they work at — what it does, its size/reputation, and why it's relevant. If the person has no company listed or it says N/A, set this to null>",
      "talking_points": ["<point 1>", "<point 2>", "<point 3>"],
      "recommendation_reason": "<1 sentence explaining why this person is a great match for the student>"
    }
  ]
}

COMPANY BIO INSTRUCTIONS:
- Write 2-3 sentences about what the company does, its industry reputation, and why a student might want to know about it.
- If the person has NO company listed (shows as "N/A"), set company_bio to null. Do NOT make up a company or write a bio for a nonexistent company.

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

    // ── Claude call ───────────────────────────────────────────────────────────
    let responseText: string
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      })
      responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    } catch (claudeErr: any) {
      console.error('[plan/generate] Claude API error:', claudeErr?.message ?? claudeErr)
      return NextResponse.json(
        { error: `AI error: ${claudeErr?.message ?? 'Unknown'}` },
        { status: 500 }
      )
    }

    // ── Parse response ────────────────────────────────────────────────────────
    let recommendations: any[]
    try {
      const cleaned = responseText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
      const parsed = JSON.parse(cleaned)
      recommendations = parsed.recommendations
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          recommendations = JSON.parse(jsonMatch[0]).recommendations
        } catch {
          console.error('[plan/generate] JSON parse failed. Raw:', responseText.slice(0, 300))
          return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
        }
      } else {
        console.error('[plan/generate] No JSON in response. Raw:', responseText.slice(0, 300))
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
      }
    }

    if (!recommendations || recommendations.length === 0) {
      console.error('[plan/generate] Empty recommendations array')
      return NextResponse.json({ error: 'No recommendations generated' }, { status: 500 })
    }

    // ── Deactivate existing plans ─────────────────────────────────────────────
    await supabase
      .from('networking_plans')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true)

    // ── Create plan ───────────────────────────────────────────────────────────
    const goalCount =
      profile.networking_intensity === '20' ? 20
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
      console.error('[plan/generate] plan insert error:', planError)
      return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
    }

    // ── Build plan_alumni rows (after plan exists — same order as live version) ─
    const planAlumniRows = recommendations.map((rec: any, i: number) => {
      // Name match first, index fallback — same as live version
      let alumnus = rec.full_name
        ? candidates.find(c => c.full_name?.toLowerCase() === rec.full_name?.toLowerCase())
        : null
      if (!alumnus && rec.index >= 1) {
        alumnus = candidates[rec.index - 1] ?? null
      }
      if (!alumnus) {
        console.warn(`[plan/generate] unmatched rec: "${rec.full_name}" idx=${rec.index}`)
        return null
      }
      return {
        plan_id: plan.id,
        alumni_id: alumnus.id,
        ai_career_summary: rec.career_summary ?? null,
        ai_company_bio: rec.company_bio ?? null,
        ai_talking_points: Array.isArray(rec.talking_points) ? rec.talking_points : [],
        ai_recommendation_reason: rec.recommendation_reason ?? null,
        status: 'active',
        sort_order: i,
      }
    }).filter(Boolean)

    if (planAlumniRows.length === 0) {
      console.error('[plan/generate] all recs unmatched. candidates:', candidates.map(c => c.full_name))
      return NextResponse.json({ error: 'Could not match recommendations to alumni' }, { status: 500 })
    }

    // ── Insert plan_alumni ────────────────────────────────────────────────────
    const { error: insertError } = await supabase
      .from('plan_alumni')
      .insert(planAlumniRows)

    if (insertError) {
      console.error('[plan/generate] plan_alumni insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save recommendations' }, { status: 500 })
    }

    // ── Fetch complete plan ───────────────────────────────────────────────────
    const { data: completePlan, error: fetchError } = await supabase
      .from('networking_plans')
      .select(`*, plan_alumni (*, alumni (*))`)
      .eq('id', plan.id)
      .single()

    if (fetchError) {
      console.error('[plan/generate] fetch complete plan error:', fetchError)
      return NextResponse.json({ error: 'Plan saved but failed to load' }, { status: 500 })
    }

    return NextResponse.json({ plan: completePlan })

  } catch (error: any) {
    console.error('[plan/generate] unexpected error:', error?.message ?? error)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to generate plan' },
      { status: 500 }
    )
  }
}
