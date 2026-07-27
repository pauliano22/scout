/** Welcome email sent when an alumni profile claim is approved */

export interface WelcomeAlumniProps {
  name: string
}

const FONT_STACK = `Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`

// Absolute URL — email clients can't resolve relative paths. www avoids the
// apex 307 redirect, which some clients refuse to follow for images.
const LOGO_URL = 'https://www.scoutcornell.com/brand/scout-logo-email.png'

export function welcomeAlumniHtml({ name }: WelcomeAlumniProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Welcome to Scout</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT_STACK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <!-- Card -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#FFFFFF;border:1px solid #e4e4e7;border-radius:12px;">
          <!-- Logo header: mark + wordmark, CORNELL label below -->
          <tr>
            <td style="padding:40px 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:12px;vertical-align:middle;">
                    <img src="${LOGO_URL}" width="36" height="36" alt="Scout" style="display:block;border:0;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:${FONT_STACK};font-size:20px;font-weight:700;color:#09090b;letter-spacing:-0.03em;line-height:1.3;">Scout</span>
                    <br>
                    <span style="font-family:${FONT_STACK};font-size:11px;font-weight:500;color:#a1a1aa;letter-spacing:0.1em;text-transform:uppercase;">CORNELL</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Heading + body -->
          <tr>
            <td style="padding:32px 40px 0;">
              <h1 style="margin:0 0 16px;font-family:${FONT_STACK};font-size:28px;font-weight:600;color:#09090b;letter-spacing:-0.03em;line-height:1.15;">Welcome to Scout, ${name}!</h1>
              <p style="margin:0;font-family:${FONT_STACK};font-size:16px;color:#3f3f46;line-height:1.65;">
                Your alumni profile has been reviewed and approved. You now have full access to the Scout directory, where you can connect with fellow Cornell athletes and help the next generation find their path.
              </p>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:32px 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#B31B1B" style="background-color:#B31B1B;border-radius:10px;">
                    <a href="https://scoutcornell.com" style="display:block;padding:12px 32px;font-family:${FONT_STACK};font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">Browse the Directory</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:32px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e4e4e7;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- What's next -->
          <tr>
            <td style="padding:32px 40px 0;">
              <h2 style="margin:0 0 16px;font-family:${FONT_STACK};font-size:18px;font-weight:600;color:#09090b;letter-spacing:-0.025em;">What's next?</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="6" valign="top" style="padding-top:8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr><td width="6" height="6" bgcolor="#B31B1B" style="width:6px;height:6px;background-color:#B31B1B;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                  <td style="padding-left:12px;font-family:${FONT_STACK};font-size:16px;color:#3f3f46;line-height:1.5;">Complete your profile to help students learn about your path</td>
                </tr>
                <tr><td colspan="2" height="12" style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td width="6" valign="top" style="padding-top:8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr><td width="6" height="6" bgcolor="#B31B1B" style="width:6px;height:6px;background-color:#B31B1B;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                  <td style="padding-left:12px;font-family:${FONT_STACK};font-size:16px;color:#3f3f46;line-height:1.5;">Connect with athletes who share your sport and ambition</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:32px 40px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e4e4e7;padding-top:24px;">
                    <p style="margin:0;font-family:${FONT_STACK};font-size:13px;color:#71717a;line-height:1.6;">
                      Scout · Cornell athlete network<br>
                      <a href="https://scoutcornell.com" style="color:#B31B1B;text-decoration:none;">scoutcornell.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function welcomeAlumniSubject(): string {
  return 'Welcome to Scout - your alumni profile is approved!'
}

export function welcomeAlumniText({ name }: WelcomeAlumniProps): string {
  return `Welcome to Scout, ${name}!

Your alumni profile has been reviewed and approved. You now have full access to the Scout directory, where you can connect with fellow Cornell athletes and help the next generation find their path.

Browse the directory: https://scoutcornell.com

What's next?
- Complete your profile to help students learn about your path
- Connect with athletes who share your sport and ambition

Scout · Cornell athlete network
scoutcornell.com`
}
