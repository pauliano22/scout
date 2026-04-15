import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planId } = await request.json()

    if (!planId) {
      return NextResponse.json({ error: 'planId required' }, { status: 400 })
    }

    // Verify the plan belongs to this user
    const { data: plan } = await supabase
      .from('networking_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Delete plan_alumni first (foreign key)
    await supabase
      .from('plan_alumni')
      .delete()
      .eq('plan_id', planId)

    // Delete custom contacts
    await supabase
      .from('plan_custom_contacts')
      .delete()
      .eq('plan_id', planId)

    // Delete the plan
    const { error: deleteError } = await supabase
      .from('networking_plans')
      .delete()
      .eq('id', planId)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}
