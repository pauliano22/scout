// GET  /api/admin/email-test           — preview the email HTML (no send)
// POST /api/admin/email-test?to=...     — actually send the test email
//
// Once Google OAuth is set up, hit POST to send a real welcome email to yourself.

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { ok, fail } from '@/lib/api/respond'
import { sendEmail, isEmailConfigured, welcomeAlumniHtml, welcomeAlumniSubject, welcomeAlumniText } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
    const html = welcomeAlumniHtml({ name: 'Robert' })
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const to = request.nextUrl.searchParams.get('to')
    if (!to) return fail('Missing ?to=email parameter', 400)

    if (!isEmailConfigured()) {
      return fail(
        'Email not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and ' +
        'GOOGLE_REFRESH_TOKEN in .env.local',
        503
      )
    }

    const name = 'Test'
    const result = await sendEmail({
      to,
      subject: welcomeAlumniSubject(),
      htmlBody: welcomeAlumniHtml({ name }),
      textBody: welcomeAlumniText({ name }),
    })

    if (!result.success) return fail(result.error || 'Send failed', 500)
    return ok({ status: 'sent', messageId: result.messageId })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}
