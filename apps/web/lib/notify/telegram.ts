// Fire-and-forget Telegram notification for admin alerts (e.g. a new alumni
// claim awaiting review). No-op if TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID aren't
// configured, and never throws — callers can `await` it without risk to the
// request flow.
//
// Setup: create a bot via @BotFather, get its token; get your chat id (message
// the bot, then GET https://api.telegram.org/bot<TOKEN>/getUpdates). Set both
// TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the Vercel project env.

export async function notifyTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      console.error('[notifyTelegram] non-ok response:', res.status)
      return false
    }
    return true
  } catch (err) {
    console.error('[notifyTelegram] failed:', err instanceof Error ? err.message : err)
    return false
  }
}
