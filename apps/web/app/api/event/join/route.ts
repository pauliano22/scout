import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code } = await request.json()

    if (!code) {
      return NextResponse.json(
        { error: 'code is required' },
        { status: 400 },
      )
    }

    // Find the session
    const { data: session, error: sessionError } = await supabase
      .from('event_chat_sessions')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Event session not found or no longer active' },
        { status: 404 },
      )
    }

    // Check if already joined
    const { data: existing } = await supabase
      .from('event_participants')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        ok: true,
        already_joined: true,
        session,
        participant_id: existing.id,
      })
    }

    // Get display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // Join the session
    const { data: participant, error: joinError } = await supabase
      .from('event_participants')
      .insert({
        session_id: session.id,
        user_id: user.id,
        display_name: profile?.full_name || user.email,
      })
      .select()
      .single()

    if (joinError) {
      return NextResponse.json(
        { error: 'Failed to join session', details: joinError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      already_joined: false,
      session,
      participant,
    })
  } catch (error) {
    console.error('Event join error:', error)
    return NextResponse.json(
      { error: 'Failed to join event session' },
      { status: 500 },
    )
  }
}
