import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('alumni')
      .select('*', { count: 'exact', head: true })

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
