import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/referral/create
 *
 * Generates a unique referral code for the authenticated user.
 * If the user already has an active referral link, returns the existing one.
 *
 * Response: { id, code, url }
 */
export async function POST() {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has an active referral link
    const { data: existing } = await supabase
      .from('referral_links')
      .select('id, code')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        id: existing.id,
        code: existing.code,
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://scout.cornell.edu'}/r/${existing.code}`,
      })
    }

    // Generate a unique 8-character referral code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    let isUnique = false

    while (!isUnique) {
      code = ''
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)]
      }

      const { data: conflict } = await supabase
        .from('referral_links')
        .select('id')
        .eq('code', code)
        .maybeSingle()

      if (!conflict) {
        isUnique = true
      }
    }

    const { data, error } = await supabase
      .from('referral_links')
      .insert({
        user_id: user.id,
        code,
      })
      .select('id, code')
      .single()

    if (error) {
      console.error('[referral/create] error:', error)
      return NextResponse.json({ error: 'Failed to create referral link' }, { status: 500 })
    }

    return NextResponse.json({
      id: data.id,
      code: data.code,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://scout.cornell.edu'}/r/${data.code}`,
    })
  } catch (err) {
    console.error('[referral/create] error:', err)
    return NextResponse.json({ error: 'Failed to create referral link' }, { status: 500 })
  }
}
