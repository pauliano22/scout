import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateCompletionScore } from '@/lib/profile-completion'

/**
 * GET /api/profile/completion
 *
 * Returns the completion score and missing fields for the
 * authenticated user's alumni profile.
 *
 * Response: { score: number, missing: string[], total: number }
 */
export async function GET() {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the user's profile to get the alumni_id.
    const { data: profile } = await supabase
      .from('profiles')
      .select('alumni_id')
      .eq('id', user.id)
      .single()

    if (!profile?.alumni_id) {
      // User has no linked alumni row yet.
      return NextResponse.json({ score: 0, missing: [], total: 100 })
    }

    const { data: alumni } = await supabase
      .from('alumni')
      .select('*')
      .eq('id', profile.alumni_id)
      .single()

    if (!alumni) {
      return NextResponse.json({ score: 0, missing: [], total: 100 })
    }

    const result = calculateCompletionScore({
      photo_url: alumni.photo_url || alumni.avatar_url,
      bio: alumni.bio || undefined,
      industry: alumni.industry || undefined,
      company: alumni.company || undefined,
      role: alumni.role || undefined,
      location: alumni.location || undefined,
      grad_year: alumni.graduation_year || undefined,
      linkedin_url: alumni.linkedin_url || undefined,
      education: alumni.education || undefined,
      sport: alumni.sport || undefined,
      class_year: alumni.graduation_year || undefined,
    })

    // Persist the score to the DB for efficient querying.
    await supabase
      .from('alumni')
      .update({ completion_score: result.score })
      .eq('id', profile.alumni_id)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[profile/completion] error:', err)
    return NextResponse.json(
      { error: 'Failed to compute profile completion' },
      { status: 500 },
    )
  }
}
