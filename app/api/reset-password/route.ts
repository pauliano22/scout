import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function POST(request: NextRequest) {
  console.log('=== RESET PASSWORD POST ===')

  try {
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

    // Get the user by email using admin client
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      console.error('Error listing users:', usersError)
      return NextResponse.json(
        { error: 'Failed to verify user' },
        { status: 500 }
      )
    }

    const user = users.find(u => u.email?.toLowerCase() === resetToken.email.toLowerCase())
    console.log('User found:', user ? 'yes' : 'no')

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 400 }
      )
    }

    // Update the user's password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
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

    console.log('Password reset successful')
    return NextResponse.json({ success: true })
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
    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('Error verifying token:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to verify token' },
      { status: 500 }
    )
  }
}
