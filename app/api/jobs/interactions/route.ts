import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Get user's job interactions (saved, applied, etc.)
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const interactionType = searchParams.get('type') // 'saved', 'applied', 'dismissed', 'viewed'

    let query = supabase
      .from('user_job_interactions')
      .select(`
        *,
        job:jobs(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (interactionType) {
      query = query.eq('interaction_type', interactionType)
    }

    const { data: interactions, error } = await query

    if (error) {
      console.error('Error fetching interactions:', error)
      return NextResponse.json({ error: 'Failed to fetch interactions' }, { status: 500 })
    }

    return NextResponse.json({
      interactions: interactions || [],
    })
  } catch (error) {
    console.error('Interactions API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create job interaction (save, apply, dismiss, view)
export async function POST(request: Request) {
  try {
    const supabase = createClient()

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { job_id, interaction_type, notes } = body

    if (!job_id || !interaction_type) {
      return NextResponse.json(
        { error: 'job_id and interaction_type are required' },
        { status: 400 }
      )
    }

    // Validate interaction type
    const validTypes = ['saved', 'applied', 'dismissed', 'viewed']
    if (!validTypes.includes(interaction_type)) {
      return NextResponse.json(
        { error: 'Invalid interaction_type' },
        { status: 400 }
      )
    }

    // Check if job exists
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Upsert interaction (update if exists, insert if not)
    const { data: interaction, error } = await supabase
      .from('user_job_interactions')
      .upsert(
        {
          user_id: user.id,
          job_id,
          interaction_type,
          notes,
        },
        {
          onConflict: 'user_id,job_id,interaction_type',
        }
      )
      .select()
      .single()

    if (error) {
      console.error('Error creating interaction:', error)
      return NextResponse.json({ error: 'Failed to create interaction' }, { status: 500 })
    }

    return NextResponse.json({
      interaction,
      message: `Job ${interaction_type} successfully`,
    })
  } catch (error) {
    console.error('Create interaction API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove job interaction (unsave, etc.)
export async function DELETE(request: Request) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobId = searchParams.get('job_id')
    const interactionType = searchParams.get('type')

    if (!jobId || !interactionType) {
      return NextResponse.json(
        { error: 'job_id and type are required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('user_job_interactions')
      .delete()
      .eq('user_id', user.id)
      .eq('job_id', jobId)
      .eq('interaction_type', interactionType)

    if (error) {
      console.error('Error deleting interaction:', error)
      return NextResponse.json({ error: 'Failed to delete interaction' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Interaction removed successfully',
    })
  } catch (error) {
    console.error('Delete interaction API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
