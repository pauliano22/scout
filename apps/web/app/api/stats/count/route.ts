import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/requestAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Public aggregate for the logged-out landing page — must not depend on
    // the caller's session. Migration 052 RLS returns zero alumni rows to
    // anonymous/unapproved sessions, so a cookie client here counts 0.
    const supabase = serviceClient()
    const { count, error } = await supabase
      .from('alumni')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true)

    if (error) {
      console.error('Failed to count alumni:', error)
      return NextResponse.json({ error: 'Failed to count alumni' }, { status: 500 })
    }

    return NextResponse.json({ count: count ?? 0 })
  } catch (err) {
    console.error('Unexpected error counting alumni:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
