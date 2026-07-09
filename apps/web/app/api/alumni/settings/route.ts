import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/requestAuth'

/**
 * Small self-serve settings for a claimed alumni row. Exists because RLS on
 * `alumni` is SELECT-only (052) — browser-side UPDATEs silently match 0 rows —
 * so single-field toggles go through here instead of the full claim wizard
 * payload that /api/alumni/claim requires.
 *
 * Only whitelisted fields; the update is scoped to the caller's own claimed
 * row via claimed_by_user_id, so ownership is enforced in the WHERE clause.
 */

const ENGAGEMENT_INTENTS = ['seeking_employment', 'here_to_help', 'both'] as const

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>))

    const updates: Record<string, unknown> = {}
    if ('engagement_intent' in body) {
      const v = body.engagement_intent
      if (v !== null && !ENGAGEMENT_INTENTS.includes(v as any)) {
        return NextResponse.json({ error: 'Invalid engagement_intent.' }, { status: 400 })
      }
      updates.engagement_intent = v
    }
    if ('share_email_with_students' in body) {
      updates.share_email_with_students = Boolean(body.share_email_with_students)
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    const { data: rows, error } = await serviceClient()
      .from('alumni')
      .update(updates)
      .eq('claimed_by_user_id', user.id)
      .select('id')
    if (error) throw error
    if (!rows?.length) {
      return NextResponse.json({ error: 'No claimed profile found.' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Alumni settings error:', err)
    return NextResponse.json({ error: 'Failed to save. Please try again.' }, { status: 500 })
  }
}
