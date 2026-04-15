import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  console.log('=== FORGOT PASSWORD ROUTE HIT ===')

  try {
    const body = await request.json()
    const { email } = body

    console.log('Email received:', email)

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Create Supabase client with service role key (inside function so env vars are available)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('SUPABASE_URL exists:', !!supabaseUrl)
    console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseServiceKey)

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

    // Generate a secure random token
    const token = crypto.randomUUID()

    // Set expiration to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    // Store the token in password_reset_tokens table
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        email: email.toLowerCase(),
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

    // Send email via Resend API
    const resetUrl = `https://scoutcornell.com/reset-password?token=${token}`

    console.log('Calling Resend API...')
    console.log('Reset URL:', resetUrl)
    console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY)

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

            <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>

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

    console.log('Resend response status:', resendResponse.status)

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json()
      console.error('Resend API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to send reset email' },
        { status: 500 }
      )
    }

    const successData = await resendResponse.json()
    console.log('Resend success:', successData)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in forgot-password:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
