import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  checkRateLimit,
  addRateLimitHeaders,
  rateLimitExceeded,
  getClientIp,
} from '@/lib/rate-limit'

// ─── Per-email rate limit store (max 3 requests per email per hour) ──────
const emailRateLimitStore = new Map<string, number[]>()
const EMAIL_RATE_LIMIT = 3
const EMAIL_RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

/** Prune stale email rate-limit entries every 60 seconds. */
let lastEmailPrune = Date.now()
function pruneEmailStore(): void {
  const now = Date.now()
  if (now - lastEmailPrune < 60_000) return
  lastEmailPrune = now
  const cutoff = now - EMAIL_RATE_WINDOW_MS * 2
  for (const [key, timestamps] of emailRateLimitStore) {
    const fresh = timestamps.filter((t) => t > cutoff)
    if (fresh.length === 0) {
      emailRateLimitStore.delete(key)
    } else {
      emailRateLimitStore.set(key, fresh)
    }
  }
}

/**
 * Check per-email rate limit. Returns { allowed: true } if within limit,
 * or { allowed: false, retryAfter } if the email has exceeded the quota.
 */
function checkEmailRateLimit(email: string): { allowed: boolean; retryAfter?: number } {
  pruneEmailStore()
  const now = Date.now()
  const cutoff = now - EMAIL_RATE_WINDOW_MS
  let timestamps = emailRateLimitStore.get(email) ?? []
  timestamps = timestamps.filter((t) => t > cutoff)

  if (timestamps.length >= EMAIL_RATE_LIMIT) {
    const oldest = timestamps[0]
    return {
      allowed: false,
      retryAfter: Math.ceil((oldest + EMAIL_RATE_WINDOW_MS - now) / 1000),
    }
  }

  timestamps.push(now)
  emailRateLimitStore.set(email, timestamps)
  return { allowed: true }
}

/** Insert a row into the password_reset_audit_log table. Non-blocking — logs and swallows errors. */
async function logAuditEvent(
  supabase: ReturnType<typeof createClient>,
  action: 'request' | 'reset',
  email: string,
  ip_address: string | null,
  user_agent: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from('password_reset_audit_log').insert({
      action,
      email,
      ip_address,
      user_agent,
      metadata,
    } as never)
  } catch (err) {
    console.error('Failed to write audit log:', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit: public tier (30 req/min) keyed by IP ──
    const rl = checkRateLimit(`forgot-password:${getClientIp(request)}`, 'public')
    if (!rl.success) return rateLimitExceeded(rl)

    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase()

    // ── Per-email rate limit: max 3 requests per email per hour ──
    const emailRl = checkEmailRateLimit(normalizedEmail)
    if (!emailRl.allowed) {
      return addRateLimitHeaders(
        NextResponse.json(
          { error: 'Too many password reset requests for this email. Please try again later.' },
          { status: 429 },
        ),
        rl,
      )
    }

    // Extract IP and user agent for audit logging
    const ipAddress = getClientIp(request)
    const userAgent = request.headers.get('user-agent')

    // Create Supabase client with service role key (inside function so env vars are available)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the user exists in Supabase auth before creating a token
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
    })

    if (linkError || !linkData?.user) {
      // No auth account — could be an alumni who submitted via /join but never signed up
      return NextResponse.json(
        { error: 'No account found with this email. Please sign up first.' },
        { status: 404 }
      )
    }

    // Generate a secure random token
    const token = crypto.randomUUID()

    // Set expiration to 15 minutes from now
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // Store the token in password_reset_tokens table
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        email: normalizedEmail,
        token,
        expires_at: expiresAt,
        used: false
      })

    if (insertError) {
      console.error('Error storing reset token:', insertError)
      return NextResponse.json(
        { error: 'Failed to create reset token' },
        { status: 500 }
      )
    }

    // Log the password reset request
    await logAuditEvent(supabase, 'request', normalizedEmail, ipAddress, userAgent, {
      token_created: true,
    })

    // Send email via Resend API
    const resetUrl = `https://scoutcornell.com/reset-password?token=${token}`

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Scout <noreply@scoutcornell.com>',
        to: email,
        subject: 'Reset your Scout password',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #B31B1B; margin: 0;">Scout</h1>
            </div>

            <h2 style="color: #333; margin-bottom: 20px;">Reset your password</h2>

            <p>We received a request to reset your password for your Scout account. Click the button below to create a new password:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #B31B1B; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">Reset Password</a>
            </div>

            <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes for security reasons.</p>

            <p style="color: #666; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              Scout - Cornell Student-Athlete Network<br>
              <a href="https://scoutcornell.com" style="color: #B31B1B;">scoutcornell.com</a>
            </p>
          </body>
          </html>
        `
      })
    })

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendResponse.status)
      return NextResponse.json(
        { error: 'Failed to send reset email' },
        { status: 500 }
      )
    }

    return addRateLimitHeaders(NextResponse.json({ success: true }), rl)
  } catch (error) {
    console.error('Error in forgot-password:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
