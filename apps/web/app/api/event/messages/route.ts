import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json(
        { error: 'code query parameter is required' },
        { status: 400 },
      )
    }

    // Find the session
    const { data: session, error: sessionError } = await supabase
      .from('event_chat_sessions')
      .select('id, code, name, sport, is_active')
      .eq('code', code)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Event session not found' },
        { status: 404 },
      )
    }

    // Check user is a participant
    const { data: participant } = await supabase
      .from('event_participants')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json(
        { error: 'You must join the session to view messages' },
        { status: 403 },
      )
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('event_chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .limit(200)

    if (messagesError) {
      return NextResponse.json(
        { error: 'Failed to fetch messages', details: messagesError.message },
        { status: 500 },
      )
    }

    // Get participant count
    const { count: participantCount } = await supabase
      .from('event_participants')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id)

    return NextResponse.json({
      session,
      messages: messages || [],
      participant_count: participantCount || 0,
    })
  } catch (error) {
    console.error('Event messages error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event messages' },
      { status: 500 },
    )
  }
}
