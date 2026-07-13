/**
 * Email sending utility.
 *
 * Uses @sendgrid/mail when SENDGRID_API_KEY is set.
 * Falls back to console.log for local development.
 */

export interface SendEmailParams {
  to: string
  subject: string
  html: string
}

let sendgridInitialised = false

function initSendgrid(): boolean {
  if (sendgridInitialised) return true
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) return false

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sgMail = require('@sendgrid/mail')
    sgMail.setApiKey(apiKey)
    sendgridInitialised = true
    return true
  } catch {
    console.warn('[send] @sendgrid/mail not installed — falling back to console.log')
    return false
  }
}

/**
 * Send an email. Uses SendGrid if configured, otherwise logs to console.
 * Returns { success: true, id?: string } on success, or { success: false, error: string } on failure.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: true; id?: string } | { success: false; error: string }> {
  const from = process.env.FROM_EMAIL ?? 'Scout <noreply@scoutcornell.com>'

  if (initSendgrid()) {
    try {
      const sgMail = require('@sendgrid/mail')
      const response = await sgMail.send({ to, from, subject, html })
      const messageId = response?.[0]?.headers?.['x-message-id'] ?? undefined
      return { success: true, id: messageId }
    } catch (err: any) {
      const message = err?.message ?? err?.response?.body?.errors?.[0]?.message ?? String(err)
      console.error('[send] SendGrid error:', message)
      return { success: false, error: message }
    }
  }

  // Fallback: log to console
  console.log('[send] Email (fallback)', { to, subject, htmlLength: html.length })
  return { success: true, id: `console-${Date.now()}` }
}

export { sendEmail as default }
