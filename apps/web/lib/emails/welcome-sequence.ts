/**
 * Welcome Email Sequence — 4-email drip campaign for new users.
 *
 * Each function returns { subject, html } for the given user context.
 * The HTML is deliberately simple (inline styles only, no MJML dependency)
 * so it renders cleanly across Gmail, Outlook, and Apple Mail.
 */

export interface WelcomeEmailResult {
  subject: string
  html: string
}

const BRAND = 'Scout'
const BRAND_COLOR = '#4F46E5' // indigo-600
const LOGO_URL = 'https://scout.cornell.edu/logo.png' // placeholder
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scout.cornell.edu'

/* ---------- helpers ---------- */

function wrapperHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 0 32px;text-align:center;">
              <h1 style="margin:0;font-size:22px;color:#18181b;letter-spacing:-0.3px;">${BRAND}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
                ${BRAND} · Cornell Athlete Alumni Networking<br/>
                <a href="${BASE_URL}/unsubscribe" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe</a>
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

function buttonHtml(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0 auto;">
    <tr>
      <td align="center" style="background-color:${BRAND_COLOR};border-radius:8px;padding:0;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${text}</a>
      </td>
    </tr>
  </table>`
}

/* ---------- Day 1: Welcome ---------- */

export function day1Welcome(name: string): WelcomeEmailResult {
  const subject = `Welcome to ${BRAND}!`
  const body = `
    <p style="margin:0 0 16px 0;font-size:16px;color:#18181b;line-height:1.5;">Hi ${name},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      Welcome to <strong>${BRAND}</strong> — the networking platform built for Cornell athletes like you.
      Whether you're exploring careers, searching for internships, or building your professional
      network, ${BRAND} connects you with Cornell alumni who've been where you are.
    </p>
    <p style="margin:0 0 12px 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      Here's how to get started:
    </p>
    <ul style="margin:0 0 16px 0;padding-left:20px;font-size:15px;color:#3f3f46;line-height:1.6;">
      <li>Complete your profile so alumni can find you</li>
      <li>Tell us about your career interests and target industries</li>
      <li>Use the search to discover alumni in your field</li>
      <li>Send your first connection request</li>
    </ul>
    <p style="margin:0 0 16px 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      Start by searching for alumni who share your sport or career interests —
      you'll be surprised how many Cornellians are ready to help!
    </p>
    ${buttonHtml('Find Alumni Now', `${BASE_URL}/search`)}
    <p style="margin:24px 0 0 0;font-size:14px;color:#a1a1aa;line-height:1.5;">
      Stay tuned — we'll send you tips over the next week to help you make the most of ${BRAND}.
    </p>
  `
  return { subject, html: wrapperHtml(body) }
}

/* ---------- Day 2: Profile-Based Suggestions ---------- */

export function day2Suggestions(name: string, sport: string | null): WelcomeEmailResult {
  const sportSnippet = sport
    ? `Other ${sport} athletes have found great mentors in finance, tech, healthcare, and more.`
    : `Cornell athletes have found great mentors across every industry — finance, tech, healthcare, and more.`

  const subject = `Your ${BRAND} profile is ready — here's who to connect with`
  const body = `
    <p style="margin:0 0 16px 0;font-size:16px;color:#18181b;line-height:1.5;">Hey ${name},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      ${sportSnippet}
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      Based on your profile, here are a few ways to find the right alumni:
    </p>
    <ul style="margin:0 0 16px 0;padding-left:20px;font-size:15px;color:#3f3f46;line-height:1.6;">
      <li><strong>Filter by industry</strong> — see alumni in fields you're curious about</li>
      <li><strong>Search by company</strong> — find Cornellians at your dream employers</li>
      <li><strong>Browse by sport</strong> — the shared athlete bond makes outreach easier</li>
    </ul>
    <p style="margin:0 0 16px 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      Pro tip: Alumni are <strong>4× more likely to respond</strong> when you mention your shared
      Cornell athletics experience. Lean into it!
    </p>
    ${buttonHtml('Browse Suggestions', `${BASE_URL}/discover`)}
  `
  return { subject, html: wrapperHtml(body) }
}

/* ---------- Day 4: Network Building Tips ---------- */

export function day4Network(name: string): WelcomeEmailResult {
  const subject = `Tips for building your network on ${BRAND}`
  const body = `
    <p style="margin:0 0 16px 0;font-size:16px;color:#18181b;line-height:1.5;">Hi ${name},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      Building a strong professional network takes intention. Here are three tips to
      make your outreach on ${BRAND} more effective:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="padding:12px 0;">
          <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">1. Personalize every message</p>
          <p style="margin:4px 0 0 0;font-size:14px;color:#3f3f46;line-height:1.5;">
            Reference their specific career path, a shared Cornell experience, or something
            you genuinely admire. Generic templates get ignored.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">2. Be specific about your ask</p>
          <p style="margin:4px 0 0 0;font-size:14px;color:#3f3f46;line-height:1.5;">
            "I'd love to hear about your path from Cornell to [Company]" works better than
            "Can I pick your brain?" Alumni want to help — make it easy for them.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">3. Follow up thoughtfully</p>
          <p style="margin:4px 0 0 0;font-size:14px;color:#3f3f46;line-height:1.5;">
            If you haven't heard back in a week, send a brief, gracious follow-up.
            Alumni are busy — a gentle reminder shows persistence.
          </p>
        </td>
      </tr>
    </table>
    ${buttonHtml('Start Connecting', `${BASE_URL}/search`)}
  `
  return { subject, html: wrapperHtml(body) }
}

/* ---------- Day 7: Success Stories + CTA ---------- */

export function day7Success(name: string): WelcomeEmailResult {
  const subject = `What ${BRAND} users are saying + your next step`
  const body = `
    <p style="margin:0 0 16px 0;font-size:16px;color:#18181b;line-height:1.5;">Hi ${name},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      It's been a week since you joined ${BRAND}! Here's what other Cornell athletes
      have accomplished on the platform:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;background-color:#f8f8ff;border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#3f3f46;line-height:1.5;font-style:italic;">
            "${BRAND} helped me land a summer internship at Goldman Sachs — I connected with a
            Cornell alum who played hockey and reviewed my resume. Game changer."
          </p>
          <p style="margin:0;font-size:13px;color:#71717a;font-weight:600;">— Alex M., Hockey '26</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 20px 16px 20px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#3f3f46;line-height:1.5;font-style:italic;">
            "I was nervous about cold-messaging alumni, but the shared athlete connection made
            every conversation natural. Now I have mentors in three different industries."
          </p>
          <p style="margin:0;font-size:13px;color:#71717a;font-weight:600;">— Sarah K., Soccer '25</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      Your network is growing. Take the next step today and reach out to someone new.
    </p>
    ${buttonHtml('Go to ${BRAND}', `${BASE_URL}/today`)}
    <p style="margin:24px 0 0 0;font-size:14px;color:#a1a1aa;line-height:1.5;">
      P.S. We'll send fewer emails going forward — but you can always check your
      personalized recommendations at any time.
    </p>
  `
  return { subject, html: wrapperHtml(body) }
}

/**
 * Map day number (1, 2, 4, or 7) to the correct template function.
 */
export function renderWelcomeEmail(
  day: number,
  name: string,
  sport: string | null,
): WelcomeEmailResult {
  switch (day) {
    case 1:
      return day1Welcome(name)
    case 2:
      return day2Suggestions(name, sport)
    case 4:
      return day4Network(name)
    case 7:
      return day7Success(name)
    default:
      throw new Error(`Unknown welcome sequence day: ${day}`)
  }
}
