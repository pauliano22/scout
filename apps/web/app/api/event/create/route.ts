import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport')
    const name = searchParams.get('name')
    const event_id = searchParams.get('event_id')
    const start_time = searchParams.get('start_time')
    const end_time = searchParams.get('end_time')

    if (!sport || !name) {
      return NextResponse.json(
        { error: 'sport and name query parameters are required' },
        { status: 400 },
      )
    }

    // Generate a unique 8-character alphanumeric code
    const code = Array.from({ length: 8 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 32)),
    ).join('')

    const sessionStart = start_time || new Date().toISOString()

    // Create the session
    const { data: session, error: insertError } = await supabase
      .from('event_chat_sessions')
      .insert({
        event_id: event_id || null,
        sport,
        name,
        code,
        start_time: sessionStart,
        end_time: end_time || null,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create session', details: insertError.message },
        { status: 500 },
      )
    }

    // Generate QR code as a data URL pointing to the event page
    const eventUrl = `${request.nextUrl.origin}/event/${code}`
    const qrDataUrl = await QRCode.toDataURL(eventUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })

    // Update session with QR code URL
    await supabase
      .from('event_chat_sessions')
      .update({ qr_code_url: qrDataUrl })
      .eq('id', session.id)

    // Auto-join the creator
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    await supabase.from('event_participants').insert({
      session_id: session.id,
      user_id: user.id,
      display_name: profile?.full_name || user.email,
    })

    return NextResponse.json({
      ...session,
      qr_code_url: qrDataUrl,
      event_url: eventUrl,
    })
  } catch (error) {
    console.error('Event create error:', error)
    return NextResponse.json(
      { error: 'Failed to create event session' },
      { status: 500 },
    )
  }
}
