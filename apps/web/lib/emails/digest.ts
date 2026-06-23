/**
 * Weekly Re-Engagement Digest — Scout
 *
 * buildDigest(userId) queries the user's profile, their sport/industry network,
 * recent opportunities, and network stats, and returns an HTML email digest.
 *
 * The HTML uses Scout's brand palette:
 *   - Primary red:    #B31B1B
 *   - Warm beige:     #F5F0EB
 *   - Dark text:      #1A1A1A
 *   - Light text:     #6B7280
 */

import { createClient as createServiceClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ──────────────────────────────────────────────────────
// Types returned by the digest builder
// ──────────────────────────────────────────────────────

export interface DigestEmail {
  subject: string
  html: string
}

export interface DigestData {
  userName: string
  userEmail: string
  userSport: string | null
  userIndustry: string | null
  newConnections: number
  recentOpportunities: Array<{ id: string; title: string; company: string | null; kind: string }>
  networkStats: {
    totalConnections: number
    messagesSent: number
    meetingsScheduled: number
  }
  daysSinceLogin: number
}

// ──────────────────────────────────────────────────────
// Inline CSS helpers
// ──────────────────────────────────────────────────────

const BRAND_RED   = '#B31B1B'
const WARM_BEIGE  = '#F5F0EB'
const DARK_TEXT    = '#1A1A1A'
const LIGHT_TEXT   = '#6B7280'
const WHITE        = '#FFFFFF'

function wrapHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Scout Digest</title>
</head>
<body style="margin:0;padding:0;background-color:${WARM_BEIGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background-color:${WHITE};border-radius:8px;margin-top:24px;margin-bottom:24px;">
    <tr>
      <td style="padding:32px 24px 16px 24px;text-align:center;background-color:${BRAND_RED};border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:24px;font-weight:700;color:${WHITE};">Scout</h1>
        <p style="margin:4px 0 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Your weekly re-engagement digest</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 24px 8px 24px;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px 24px 24px;text-align:center;font-size:12px;color:${LIGHT_TEXT};border-top:1px solid #E5E7EB;">
        <p style="margin:0 0 8px 0;">You received this because you haven't visited Scout in a while.</p>
        <p style="margin:0;">
          <a href="{{UNSUBSCRIBE_LINK}}" style="color:${BRAND_RED};text-decoration:underline;">Unsubscribe</a>
        </p>
        <p style="margin:8px 0 0 0;">&copy; ${new Date().getFullYear()} Scout &mdash; Cornell Athletics Alumni Network</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function statBox(label: string, value: string | number): string {
  return `
    <td style="text-align:center;padding:12px 8px;background-color:${WARM_BEIGE};border-radius:6px;width:33%;">
      <div style="font-size:22px;font-weight:700;color:${BRAND_RED};line-height:1.2;">${value}</div>
      <div style="font-size:12px;color:${LIGHT_TEXT};margin-top:2px;">${label}</div>
    </td>`
}

// ──────────────────────────────────────────────────────
// Digest data fetcher
// ──────────────────────────────────────────────────────

export async function fetchDigestData(userId: string): Promise<DigestData> {
  const sb = createServiceClient(SUPABASE_URL, SERVICE_KEY)

  // 1. Profile
  const { data: profile } = await sb
    .from('profiles')
    .select('id, email, full_name, sport, industry, updated_at')
    .eq('id', userId)
    .single()

  if (!profile) {
    throw new Error(`Profile not found for user ${userId}`)
  }

  // 2. Network connections (alumni the user has connected with)
  const { count: totalConnections } = await sb
    .from('user_networks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // 3. Messages sent by this user
  const { count: messagesSent } = await sb
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // 4. Meetings scheduled (interactions of type in_person / coffee / video_call)
  const { count: meetingsScheduled } = await sb
    .from('interactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('type', ['coffee', 'video_call', 'in_person'])

  // 5. Recent opportunities (last 14 days)
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: opportunities } = await sb
    .from('opportunities')
    .select('id, title, company, kind')
    .eq('is_active', true)
    .gte('created_at', twoWeeksAgo)
    .order('created_at', { ascending: false })
    .limit(5)

  // 6. New alumni connections in the user's sport or industry
  //    (alumni who are in the same sport OR industry as the user's profile)
  const sport = profile.sport
  const industry = profile.industry
  let newConnections = 0

  if (sport || industry) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const query = sb
      .from('alumni')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo)

    if (sport && industry) {
      query.or(`sport.eq.${sport},industry.eq.${industry}`)
    } else if (sport) {
      query.eq('sport', sport)
    } else if (industry) {
      query.eq('industry', industry)
    }

    const { count } = await query
    newConnections = count ?? 0
  }

  // 7. Days since login (approximate from profile.updated_at as proxy)
  const lastUpdate = new Date(profile.updated_at)
  const daysSinceLogin = Math.floor(
    (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24),
  )

  return {
    userName: profile.full_name || 'there',
    userEmail: profile.email,
    userSport: profile.sport,
    userIndustry: profile.industry,
    newConnections,
    recentOpportunities: (opportunities ?? []).map((o) => ({
      id: o.id,
      title: o.title,
      company: o.company,
      kind: o.kind,
    })),
    networkStats: {
      totalConnections: totalConnections ?? 0,
      messagesSent: messagesSent ?? 0,
      meetingsScheduled: meetingsScheduled ?? 0,
    },
    daysSinceLogin,
  }
}

// ──────────────────────────────────────────────────────
// HTML builder
// ──────────────────────────────────────────────────────

export function buildDigestHtml(data: DigestData): DigestEmail {
  const {
    userName,
    newConnections,
    recentOpportunities,
    networkStats,
    daysSinceLogin,
  } = data

  const weekOrWeeks = daysSinceLogin >= 14
    ? `${Math.floor(daysSinceLogin / 7)} weeks`
    : `${daysSinceLogin} days`

  // ── Hero section ──
  const hero = `
    <h2 style="margin:0 0 8px 0;font-size:20px;color:${DARK_TEXT};">Welcome back${userName !== 'there' ? `, ${userName}` : ''}!</h2>
    <p style="margin:0 0 16px 0;font-size:14px;color:${LIGHT_TEXT};line-height:1.5;">
      It's been <strong style="color:${BRAND_RED};">${weekOrWeeks}</strong> since your last visit.
      Here's what you've missed on Scout.
    </p>`

  // ── Stats row ──
  const stats = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
      <tr>
        ${statBox('Connections', networkStats.totalConnections)}
        ${statBox('Messages', networkStats.messagesSent)}
        ${statBox('Meetings', networkStats.meetingsScheduled)}
      </tr>
    </table>`

  // ── New connections ──
  let connectionsSection = ''
  if (newConnections > 0) {
    connectionsSection = `
      <h3 style="margin:0 0 8px 0;font-size:16px;color:${DARK_TEXT};">🔗 New Alumni Available</h3>
      <p style="margin:0 0 16px 0;font-size:14px;color:${LIGHT_TEXT};line-height:1.5;">
        ${newConnections} new ${data.userSport ? data.userSport : ''} ${data.userIndustry ? `or ${data.userIndustry} ` : ''}alumni
        have joined Scout recently. Expand your network!
      </p>`
  }

  // ── Recent opportunities ──
  let oppSection = ''
  if (recentOpportunities.length > 0) {
    const oppList = recentOpportunities
      .map(
        (o) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:14px;color:${DARK_TEXT};">
            <strong>${o.title}</strong>
            ${o.company ? `<span style="color:${LIGHT_TEXT};"> — ${o.company}</span>` : ''}
            <span style="display:inline-block;font-size:11px;padding:2px 6px;border-radius:4px;background:${WARM_BEIGE};color:${LIGHT_TEXT};margin-left:8px;text-transform:capitalize;">${o.kind}</span>
          </td>
        </tr>`,
      )
      .join('')

    oppSection = `
      <h3 style="margin:16px 0 8px 0;font-size:16px;color:${DARK_TEXT};">💼 Recent Opportunities</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #E5E7EB;border-radius:6px;margin-bottom:16px;">
        ${oppList}
      </table>`
  }

  // ── CTA ──
  const cta = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:16px;">
      <tr>
        <td style="text-align:center;">
          <a href="{{APP_URL}}/dashboard"
             style="display:inline-block;padding:12px 32px;background-color:${BRAND_RED};color:${WHITE};text-decoration:none;font-size:15px;font-weight:600;border-radius:6px;">
            Visit Scout
          </a>
        </td>
      </tr>
    </table>`

  const bodyHtml = [hero, stats, connectionsSection, oppSection, cta].join('\n')

  return {
    subject: `Your Scout weekly roundup — ${newConnections} new alumni, ${recentOpportunities.length} new opportunities`,
    html: wrapHtml(bodyHtml),
  }
}

// ──────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────

/**
 * Build a complete digest email for a given userId.
 * Fetches live data and returns { subject, html }.
 */
export async function buildDigest(userId: string): Promise<DigestEmail> {
  const data = await fetchDigestData(userId)
  return buildDigestHtml(data)
}
