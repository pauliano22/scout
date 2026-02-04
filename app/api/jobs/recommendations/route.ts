import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateProfileEmbedding } from '@/lib/jobs'

// GET: Get personalized job recommendations for current user
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const matchThreshold = parseFloat(searchParams.get('threshold') || '0.5')
    const matchCount = parseInt(searchParams.get('limit') || '20')

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if user has an embedding
    let userEmbedding = profile.embedding

    // If no embedding, generate one from their profile
    if (!userEmbedding) {
      try {
        const embeddingArray = await generateProfileEmbedding({
          interests: profile.interests,
          industry: profile.industry,
          role: profile.role,
          company: profile.company,
          sport: profile.sport,
          location: profile.location,
        })

        // Store the embedding for future use
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ embedding: embeddingArray })
          .eq('id', user.id)

        if (updateError) {
          console.error('Failed to store profile embedding:', updateError)
        }

        userEmbedding = embeddingArray
      } catch (embeddingError) {
        console.error('Failed to generate profile embedding:', embeddingError)
        // Fall back to non-personalized results
        const { data: jobs } = await supabase
          .from('jobs')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(matchCount)

        return NextResponse.json({
          jobs: jobs || [],
          personalized: false,
          message: 'Showing recent jobs (embedding generation failed)',
        })
      }
    }

    // Use the match_jobs function for vector similarity search
    const { data: recommendations, error: matchError } = await supabase
      .rpc('get_job_recommendations', {
        p_user_id: user.id,
        match_threshold: matchThreshold,
        match_count: matchCount,
      })

    if (matchError) {
      console.error('Match jobs error:', matchError)
      // Fall back to regular query
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(matchCount)

      return NextResponse.json({
        jobs: jobs || [],
        personalized: false,
        message: 'Showing recent jobs (matching failed)',
      })
    }

    return NextResponse.json({
      jobs: recommendations || [],
      personalized: true,
      total: recommendations?.length || 0,
    })
  } catch (error) {
    console.error('Recommendations API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
