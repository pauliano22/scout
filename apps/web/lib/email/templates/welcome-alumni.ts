/** Welcome email sent when an alumni profile claim is approved */

export interface WelcomeAlumniProps {
  name: string
}

export function welcomeAlumniHtml({ name }: WelcomeAlumniProps): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f1ec;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1ec;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <!-- Card -->
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
          <!-- Header / Logo -->
          <tr>
            <td style="padding:40px 40px 0;text-align:left;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:40px;height:40px;border:2px solid #AF2318;border-radius:50%;text-align:center;vertical-align:middle;font-size:22px;font-weight:800;color:#AF2318;line-height:36px;">S</td>
                  <td style="padding-left:10px;font-weight:700;font-size:22px;color:#211c17;letter-spacing:-.02em;">Scout</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 0;">
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;color:#211c17;letter-spacing:-.02em;">Welcome to Scout, ${name}!</h1>
              <p style="margin:0 0 20px;font-size:16px;color:#5f5951;line-height:1.6;">
                Your alumni profile has been reviewed and approved. You now have full access to the Scout directory, where you can connect with fellow Cornell athletes and help the next generation find their path.
              </p>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#AF2318;border-radius:8px;padding:14px 32px;text-align:center;">
                    <a href="https://scoutcornell.com" style="color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;display:block;">Browse the Directory →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e4dccf;margin:0 0 24px;">
            </td>
          </tr>
          <!-- What's next -->
          <tr>
            <td style="padding:0 40px 8px;">
              <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#211c17;">What's next?</h2>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:6px;height:6px;background:#AF2318;border-radius:50%;vertical-align:middle;"></td>
                  <td style="padding-left:12px;font-size:15px;color:#5f5951;line-height:1.5;">Complete your profile to help students learn about your path</td>
                </tr>
                <tr><td colspan="2" style="height:10px;"></td></tr>
                <tr>
                  <td style="width:6px;height:6px;background:#AF2318;border-radius:50%;vertical-align:middle;"></td>
                  <td style="padding-left:12px;font-size:15px;color:#5f5951;line-height:1.5;">Post opportunities — internships, jobs, coffee chats</td>
                </tr>
                <tr><td colspan="2" style="height:10px;"></td></tr>
                <tr>
                  <td style="width:6px;height:6px;background:#AF2318;border-radius:50%;vertical-align:middle;"></td>
                  <td style="padding-left:12px;font-size:15px;color:#5f5951;line-height:1.5;">Connect with athletes who share your sport and ambition</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:32px 40px;border-top:1px solid #e4dccf;">
              <p style="margin:0;font-size:13px;color:#847c72;line-height:1.5;">
                Scout · Cornell athlete network<br>
                <a href="https://scoutcornell.com" style="color:#AF2318;text-decoration:none;">scoutcornell.com</a>
              </p>
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
  return 'Welcome to Scout — your alumni profile is approved!'
}

export function welcomeAlumniText({ name }: WelcomeAlumniProps): string {
  return `Welcome to Scout, ${name}!

Your alumni profile has been reviewed and approved. You now have full access to the Scout directory, where you can connect with fellow Cornell athletes and help the next generation find their path.

Browse the directory → https://scoutcornell.com

What's next?
• Complete your profile to help students learn about your path
• Post opportunities — internships, jobs, coffee chats
• Connect with athletes who share your sport and ambition

— Scout · Cornell athlete network`
}
