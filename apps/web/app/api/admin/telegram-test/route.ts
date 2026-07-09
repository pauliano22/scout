// POST /api/admin/telegram-test — admin-only Telegram diagnostic.
// Reports whether the DEPLOYED app actually has the Telegram env vars, and
// attempts a live send. Lets us tell "env not set in this deployment" apart
// from "bot/chat misconfigured" without doing a full fake signup.

import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { ok, fail } from '@/lib/api/respond'
import { notifyTelegram } from '@/lib/notify/telegram'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await requireAdmin()
    const hasToken = Boolean(process.env.TELEGRAM_BOT_TOKEN)
    const hasChatId = Boolean(process.env.TELEGRAM_CHAT_ID)

    let sent = false
    if (hasToken && hasChatId) {
      sent = await notifyTelegram(
        '✅ Scout admin test — if you see this, Telegram alerts are live from the deployed app.',
      )
    }

    return ok({ hasToken, hasChatId, sent })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
