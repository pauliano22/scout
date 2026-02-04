import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Get single job details
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const jobId = params.id

    // Get job details
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('is_active', true)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check if user has interacted with this job
    const { data: { user } } = await supabase.auth.getUser()

    let userInteraction = null
    if (user) {
      const { data: interaction } = await supabase
        .from('user_job_interactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      userInteraction = interaction
    }

    return NextResponse.json({
      job,
      userInteraction,
    })
  } catch (error) {
    console.error('Job details API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
