/**
 * Email sending via Gmail API (Google OAuth2)
 *
 * To set up:
 *   1. Create OAuth credentials in Google Cloud Console (see GOOGLE_CLIENT_* env vars)
 *   2. Run the OAuth flow to get a refresh token
 *   3. Store the refresh token in GOOGLE_REFRESH_TOKEN env var
 *
 * For Scout, the email comes from team@scoutcornell.com (configured via GOOGLE_EMAIL).
 */

import { google } from 'googleapis'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || ''
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL || 'team@scoutcornell.com'

/** Returns true if the email service is configured with valid credentials */
export function isEmailConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN)
}

/**
 * Send an email via Gmail API
 *
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param htmlBody - HTML body content
 * @param textBody - Plain text fallback
 */
export async function sendEmail({
  to,
  subject,
  htmlBody,
  textBody,
}: {
  to: string
  subject: string
  htmlBody: string
  textBody?: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isEmailConfigured()) {
    return { success: false, error: 'Email not configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN' }
  }

  try {
    const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
    auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN })

    const gmail = google.gmail({ version: 'v1', auth })

    // Build the raw email (RFC 2822)
    const emailLines: string[] = [
      `From: "Scout" <${GOOGLE_EMAIL}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="scout-email-boundary"',
      '',
      '--scout-email-boundary',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(textBody || htmlBody.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).toString('base64'),
      '',
      '--scout-email-boundary',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlBody).toString('base64'),
      '',
      '--scout-email-boundary--',
    ]

    const raw = Buffer.from(emailLines.join('\r\n')).toString('base64url')

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })

    return { success: true, messageId: response.data.id ?? undefined }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[email] Failed to send:', message)
    return { success: false, error: message }
  }
}
