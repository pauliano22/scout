import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ok, fail } from '@/lib/api/respond'
import { NotificationType, TemplateVariables } from '@/lib/notifications/templates'
import { sendNotification } from '@/lib/notifications/send'

/**
 * POST /api/notifications/send
 *
 * Formats and dispatches a branded push notification for a given recipient.
 * The endpoint validates the notification type, resolves the recipient's
 * timezone from their profile (if available), and respects quiet-hours
 * timing rules — notifications outside the allowed window are blocked
 * and reported in the response.
 *
 * Request body:
 * {
 *   type: NotificationType,
 *   recipient_id: string,
 *   data: TemplateVariables
 * }
 *
 * Response (200):
 * {
 *   data: {
 *     delivered: boolean,
 *     payload: { ... formatted push payload ... },
 *     message: string
 *   },
 *   error: null
 * }
 *
 * Response (4xx):
 * { data: null, error: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Authenticate ──────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return fail('Not authenticated', 401)
    }

    // ── Validate request body ─────────────────────────────────────
    const body = await request.json()
    const { type, recipient_id, data } = body as {
      type?: string
      recipient_id?: string
      data?: Record<string, unknown>
    }

    if (!type || typeof type !== 'string') {
      return fail('Missing or invalid "type". Must be a valid NotificationType.', 400)
    }

    if (!recipient_id || typeof recipient_id !== 'string') {
      return fail('Missing or invalid "recipient_id". Must be a non-empty string.', 400)
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return fail('Missing or invalid "data". Must be an object of template variables.', 400)
    }

    // ── Validate notification type ────────────────────────────────
    if (!Object.values(NotificationType).includes(type as NotificationType)) {
      return fail(
        `Invalid notification type "${type}". Valid types: ${Object.values(NotificationType).join(', ')}`,
        400,
      )
    }

    const notificationType = type as NotificationType

    // ── Cast data to TemplateVariables ────────────────────────────
    const variables: TemplateVariables = { ...data } as unknown as TemplateVariables

    // ── Optionally resolve recipient timezone from profile ────────
    // The profile.location field may hold a tz; if not, sendNotification
    // defaults to UTC for its quiet-hours check.
    let timezone: string | undefined
    if (recipient_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('location')
        .eq('id', recipient_id)
        .maybeSingle()

      if (profile?.location) {
        timezone = profile.location
      }
    }

    // ── Send ──────────────────────────────────────────────────────
    const result = await sendNotification(
      notificationType,
      {
        id: recipient_id,
        timezone,
      },
      variables,
    )

    return ok(result, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    console.error('[NOTIFICATIONS] Error in POST /api/notifications/send:', err)
    return fail(message, 500)
  }
}
