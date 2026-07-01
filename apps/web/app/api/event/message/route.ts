import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code, content } = await request.json()

    if (!code || !content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'code and content are required (content must be non-empty)' },
        { status: 400 },
      )
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: 'Message too long (max 2000 characters)' },
        { status: 400 },
      )
    }

    // Find the session
    const { data: session, error: sessionError } = await supabase
      .from('event_chat_sessions')
      .select('id, is_active')
      .eq('code', code)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Event session not found' },
        { status: 404 },
      )
    }

    if (!session.is_active) {
      return NextResponse.json(
        { error: 'This event session is no longer active' },
        { status: 403 },
      )
    }

    // Check user is a participant
    const { data: participant } = await supabase
      .from('event_participants')
      .select('display_name')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json(
        { error: 'You must join the session before sending messages' },
        { status: 403 },
      )
    }

    // Send the message
    const { data: message, error: messageError } = await supabase
      .from('event_chat_messages')
      .insert({
        session_id: session.id,
        user_id: user.id,
        display_name: participant.display_name || user.email,
        content: content.trim(),
      })
      .select()
      .single()

    if (messageError) {
      return NextResponse.json(
        { error: 'Failed to send message', details: messageError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, message })
  } catch (error) {
    console.error('Event message error:', error)
    return NextResponse.json(
      { error: 'Failed to send event message' },
      { status: 500 },
    )
  }
}
