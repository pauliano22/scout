import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/actions
 * Fetch user's pending suggested actions
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '10')
    const alumniId = searchParams.get('alumni_id')

    let query = supabase
      .from('suggested_actions')
      .select(`
        *,
        alumni:alumni_id (
          id,
          full_name,
          company,
          role,
          linkedin_url,
          email
        )
      `)
      .eq('user_id', user.id)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Optional: filter by alumni
    if (alumniId) {
      query = query.eq('alumni_id', alumniId)
    }

    // Exclude expired actions
    query = query.or('expires_at.is.null,expires_at.gt.now()')

    const { data: actions, error } = await query

    if (error) {
      console.error('Error fetching actions:', error)
      return NextResponse.json({ error: 'Failed to fetch actions' }, { status: 500 })
    }

    return NextResponse.json({ actions })
  } catch (error) {
    console.error('Error in GET /api/actions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/actions
 * Create a new suggested action
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      action_type,
      payload,
      alumni_id,
      coaching_plan_id,
      message_id,
      ai_reasoning,
      confidence_score,
      expires_at
    } = body

    // Validate required fields
    if (!action_type || !payload) {
      return NextResponse.json(
        { error: 'Missing required fields: action_type and payload' },
        { status: 400 }
      )
    }

    // Validate action_type
    const validTypes = ['calendar_event', 'email_draft', 'linkedin_message', 'follow_up']
    if (!validTypes.includes(action_type)) {
      return NextResponse.json(
        { error: `Invalid action_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const { data: action, error } = await supabase
      .from('suggested_actions')
      .insert({
        user_id: user.id,
        action_type,
        payload,
        alumni_id: alumni_id || null,
        coaching_plan_id: coaching_plan_id || null,
        message_id: message_id || null,
        ai_reasoning: ai_reasoning || null,
        confidence_score: confidence_score || null,
        expires_at: expires_at || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating action:', error)
      return NextResponse.json({ error: 'Failed to create action' }, { status: 500 })
    }

    return NextResponse.json({ action }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/actions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
