import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ok, fail } from '@/lib/api/respond'
import { notifyTelegram } from '@/lib/notify/telegram'

// notifyTelegram sends with parse_mode HTML — escape user-supplied text so a
// report reason (or a scraped name) can't inject markup.
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * POST /api/report
 * Students flag an alumni profile as incorrect / problematic.
 * Inserts into reported_content for admin moderation.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return fail('Not authenticated', 401)
    }

    const body = await request.json()
    const { alumniId, reason } = body

    if (!alumniId) {
      return fail('Missing alumniId', 400)
    }

    if (!reason || reason.trim().length < 5) {
      return fail('Please provide a reason (at least 5 characters)', 400)
    }

    const { data, error } = await supabase
      .from('reported_content')
      .insert({
        user_id: user.id,
        content_type: 'alumni',
        content_id: alumniId,
        reason: reason.trim(),
        status: 'flagged',
      })
      .select()
      .single()

    if (error) throw error

    // Real-time moderation alert to Telegram (best-effort; never blocks/breaks
    // the report). Resolve the alum's name so the message is readable.
    const { data: alum } = await supabase
      .from('alumni')
      .select('full_name, company')
      .eq('id', alumniId)
      .maybeSingle()
    const who = alum
      ? `${alum.full_name}${alum.company ? ` · ${alum.company}` : ''}`
      : alumniId
    await notifyTelegram(
      `🚩 Profile flagged on Scout\n${escapeHtml(who)}\nReason: ${escapeHtml(reason.trim())}`,
    )

    return ok(data, 201)
  } catch (e) {
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
