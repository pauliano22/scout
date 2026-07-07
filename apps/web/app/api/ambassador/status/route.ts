import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AmbassadorProfile } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ambassador/status
 * Returns the current user's ambassador profile (if any).
 */
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: ambassador, error } = await supabase
      .from('ambassador_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Ambassador status error:', error)
      return NextResponse.json({ error: 'Failed to fetch ambassador status' }, { status: 500 })
    }

    return NextResponse.json({ ambassador: ambassador as AmbassadorProfile | null })
  } catch (err: any) {
    console.error('Ambassador status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
