import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function requireUser(supabase: any) {
  return {
    async check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthorized')
      return user
    }
  }
}

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  try {
    const user = await requireUser(supabase).check()
    const { data } = await supabase
      .from('digest_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      subscribed_sports: data?.subscribed_sports || [],
      digest_frequency: data?.digest_frequency || 'weekly',
      last_sent_at: data?.last_sent_at || null,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  try {
    const user = await requireUser(supabase).check()
    const body = await request.json()
    const { subscribed_sports, digest_frequency } = body

    if (digest_frequency && !['weekly', 'monthly', 'never'].includes(digest_frequency)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
    }

    if (subscribed_sports && !Array.isArray(subscribed_sports)) {
      return NextResponse.json({ error: 'subscribed_sports must be an array' }, { status: 400 })
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (subscribed_sports) updates.subscribed_sports = subscribed_sports
    if (digest_frequency) updates.digest_frequency = digest_frequency

    const { error } = await supabase.from('digest_settings').upsert({
      user_id: user.id,
      ...updates,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
