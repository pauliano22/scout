/**
 * Alumni claim acceptance email.
 *
 * Branded HTML matching the site design system (globals.css):
 * Inter stack, carnelian #B31B1B accent, warm beige #f5f0e8 ground,
 * zinc text scale. Table-based layout so it renders correctly in
 * Gmail, Apple Mail, and Outlook.
 */

const FONT_STACK =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

const LOGO_URL = 'https://scoutcornell.com/brand/scout-logo-email.png'
const DIRECTORY_URL = 'https://scoutcornell.com/discover'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function alumniAcceptanceEmail(fullName: string | null | undefined) {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? ''
  const headline = first ? `Welcome to Scout, ${escapeHtml(first)}.` : 'Welcome to Scout.'

  const bullet = (text: string) => `
                <tr>
                  <td style="vertical-align:top; padding:5px 12px 5px 2px; font-family:${FONT_STACK}; font-size:16px; line-height:24px; color:#B31B1B;">&#8226;</td>
                  <td style="vertical-align:top; padding:5px 0; font-family:${FONT_STACK}; font-size:15.5px; line-height:24px; color:#3f3f46;">${text}</td>
                </tr>`

  const divider = `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0 0;">
                <tr><td style="border-top:1px solid #e4e4e7; font-size:0; line-height:0;">&nbsp;</td></tr>
              </table>`

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Your alumni profile is approved</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f0e8;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    You now have full access to the Scout directory.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f0e8;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#ffffff; border-radius:16px;">
          <tr>
            <td style="padding:48px 48px 40px 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle; padding-right:9px;">
                    <img src="${LOGO_URL}" width="36" height="36" alt="Scout" style="display:block; border:0;" />
                  </td>
                  <td style="vertical-align:middle; font-family:${FONT_STACK}; font-size:20px; font-weight:700; letter-spacing:-0.03em; color:#09090b;">scout</td>
                </tr>
              </table>
              <h1 style="margin:36px 0 0 0; font-family:${FONT_STACK}; font-size:28px; line-height:34px; font-weight:600; letter-spacing:-0.025em; color:#09090b;">${headline}</h1>
              <p style="margin:18px 0 0 0; font-family:${FONT_STACK}; font-size:16px; line-height:26px; color:#3f3f46;">
                Your alumni profile has been reviewed and approved. You now have full access to the Scout directory, where you can connect with fellow Cornell athletes and help the next generation find their path.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0 0;">
                <tr>
                  <td style="border-radius:8px; background-color:#B31B1B;">
                    <a href="${DIRECTORY_URL}" target="_blank" style="display:inline-block; padding:13px 26px; font-family:${FONT_STACK}; font-size:15px; font-weight:600; letter-spacing:-0.01em; color:#ffffff; text-decoration:none; border-radius:8px;">Browse the Directory</a>
                  </td>
                </tr>
              </table>
              ${divider}
              <h2 style="margin:28px 0 0 0; font-family:${FONT_STACK}; font-size:18px; line-height:24px; font-weight:600; letter-spacing:-0.02em; color:#09090b;">What's next?</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0 0;">${bullet('Complete your profile so students can learn from your path')}${bullet('Post internships, jobs, and coffee chats')}${bullet('Connect with athletes who share your sport and ambition')}
              </table>
              ${divider}
              <p style="margin:24px 0 0 0; font-family:${FONT_STACK}; font-size:13.5px; line-height:21px; color:#71717a;">
                Scout &middot; Cornell athlete network<br />
                <a href="https://scoutcornell.com" target="_blank" style="color:#B31B1B; text-decoration:none;">scoutcornell.com</a>
              </p>
              <p style="margin:12px 0 0 0; font-family:${FONT_STACK}; font-size:12.5px; line-height:19px; color:#a1a1aa;">
                You're receiving this because you claimed your alumni profile on Scout.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: 'Your alumni profile is approved', html } as const
}
