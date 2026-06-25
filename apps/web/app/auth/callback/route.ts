import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hashToken, generateSessionToken, getSessionExpiry } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  
  // Handle different auth flows
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  const supabase = createClient()

  // Handle email confirmation (signup, password reset, etc.)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })
    
    if (!error) {
      // Create a session record after successful verification
      await createSessionForUser(supabase)
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    return NextResponse.redirect(`${origin}/login?error=Could not verify email`)
  }

  // Handle OAuth or magic link with code
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Create a session record after successful OAuth login
      await createSessionForUser(supabase)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to login page if there's an error
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`)
}

/**
 * Create a session record after successful authentication.
 * This links the Supabase auth session to our sessions table for rotation tracking.
 */
async function createSessionForUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const sessionToken = generateSessionToken()
  const tokenHash = hashToken(sessionToken)

  await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: getSessionExpiry().toISOString(),
    })
}