import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  
  // Handle different auth flows
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'  // Changed to home page

  const supabase = createClient()

  // Handle email confirmation (signup, password reset, etc.)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    return NextResponse.redirect(`${origin}/login?error=Could not verify email`)
  }

  // Handle OAuth or magic link with code
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to login page if there's an error
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`)
}