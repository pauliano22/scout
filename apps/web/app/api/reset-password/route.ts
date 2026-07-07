import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  checkRateLimit,
  addRateLimitHeaders,
  rateLimitExceeded,
  getClientIp,
} from '@/lib/rate-limit'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/** Insert a row into the password_reset_audit_log table. Non-blocking — logs and swallows errors. */
async function logAuditEvent(
  // internal audit helper; client generic varies across supabase-js versions
  supabase: any,
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
  console.log('=== RESET PASSWORD POST ===')

  try {
    // ── Rate limit: public tier (30 req/min) keyed by IP ──
    const rl = checkRateLimit(`reset-password:${getClientIp(request)}`, 'public')
    if (!rl.success) return rateLimitExceeded(rl)

    const body = await request.json()
    const { token, password } = body

    console.log('Token received:', token ? 'yes' : 'no')

    if (!token) {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      )
    }

    if (!password) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Verify the token exists and is valid
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single()

    console.log('Token lookup result:', resetToken ? 'found' : 'not found', tokenError?.message || '')

    if (tokenError || !resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (new Date(resetToken.expires_at) < new Date()) {
      console.log('Token expired')
      return NextResponse.json(
        { error: 'Reset link has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Look up the user by email via generateLink (reliable single-call lookup by email)
    const { data: linkData, error: userError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: resetToken.email,
    })
    console.log('User found:', linkData?.user ? 'yes' : 'no')

    if (userError || !linkData?.user) {
      console.error('Error finding user:', userError)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 400 }
      )
    }

    // Update the user's password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      linkData.user.id,
      { password }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    // Mark the token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', token)

    // Log the successful password reset
    await logAuditEvent(
      supabase,
      'reset',
      resetToken.email,
      getClientIp(request),
      request.headers.get('user-agent'),
      { success: true },
    )

    console.log('Password reset successful')
    return addRateLimitHeaders(NextResponse.json({ success: true }), rl)
  } catch (error) {
    console.error('Error in reset-password:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// GET endpoint to verify token validity (used by the frontend to check before showing form)
export async function GET(request: NextRequest) {
  console.log('=== RESET PASSWORD GET (verify token) ===')

  try {
    // ── Rate limit: public tier (30 req/min) keyed by IP ──
    const rl = checkRateLimit(`reset-password-verify:${getClientIp(request)}`, 'public')
    if (!rl.success) return rateLimitExceeded(rl)

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    console.log('Verifying token:', token ? 'present' : 'missing')

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'No token provided' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Check if token exists and is valid
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('expires_at, used')
      .eq('token', token)
      .single()

    console.log('Token lookup:', resetToken ? 'found' : 'not found', tokenError?.message || '')

    if (tokenError || !resetToken) {
      return NextResponse.json(
        { valid: false, error: 'Invalid reset link' },
        { status: 400 }
      )
    }

    if (resetToken.used) {
      console.log('Token already used')
      return NextResponse.json(
        { valid: false, error: 'This reset link has already been used' },
        { status: 400 }
      )
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      console.log('Token expired')
      return NextResponse.json(
        { valid: false, error: 'Reset link has expired' },
        { status: 400 }
      )
    }

    console.log('Token valid')
    return addRateLimitHeaders(NextResponse.json({ valid: true }), rl)
  } catch (error) {
    console.error('Error verifying token:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to verify token' },
      { status: 500 }
    )
  }
}
