// Middleware: Session Token Rotation & Hardening
//
// On every request:
// 1. Extract the session token from the Authorization header or cookie
// 2. Look up the session in the database
// 3. Check expiry (reject if older than 30 days)
// 4. Check revocation status
// 5. Rotate the token on each use (issue new signed token, revoke old)
//
// Skipped for public routes (login, auth callback, API routes with their own auth).

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { hashToken, generateSessionToken, extractBearerToken, getSessionExpiry } from '@/lib/auth/session'

// Routes that don't require session validation
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/auth/callback',
  '/api/auth/',
  '/_next/',
  '/favicon.ico',
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip session checks for public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Create a Supabase client using the request cookies so we can verify the session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: (url: any, init: any) => fetch(url, { ...init, cache: 'no-store' }) },
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Can't set cookies in middleware redirects — handled by response
        },
        remove(name: string, options: CookieOptions) {
          // Can't remove cookies in middleware redirects
        },
      },
    }
  )

  // Get the authenticated user from Supabase Auth
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    // If this is an API route, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Otherwise redirect to login
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Extract session token from the authorization header or cookie
  const authHeader = request.headers.get('authorization')
  const sessionToken = extractBearerToken(authHeader) || request.cookies.get('sb-session-token')?.value

  if (sessionToken) {
    const tokenHash = hashToken(sessionToken)

    // Look up the session in the database
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      // Session not found — could be expired and cleaned up, or invalid
      // For API routes, return 401
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Session not found or expired' }, { status: 401 })
      }
      const url = new URL('/login', request.url)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      // Expired — revoke and clean up
      await supabase
        .from('sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', session.id)

      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Session expired' }, { status: 401 })
      }
      const url = new URL('/login', request.url)
      url.searchParams.set('error', 'Session expired')
      return NextResponse.redirect(url)
    }

    // Check revocation
    if (session.revoked_at) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Session revoked' }, { status: 401 })
      }
      const url = new URL('/login', request.url)
      url.searchParams.set('error', 'Session revoked')
      return NextResponse.redirect(url)
    }

    // Rotate the token: revoke old, issue new
    const newToken = generateSessionToken()
    const newTokenHash = hashToken(newToken)

    // Revoke old session
    await supabase
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', session.id)

    // Create new session with rotated token
    await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        token_hash: newTokenHash,
        expires_at: getSessionExpiry().toISOString(),
        user_agent: request.headers.get('user-agent') || null,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      })

    // Create the response
    const response = NextResponse.next()

    // Set the new token in a cookie
    response.cookies.set('sb-session-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  }

  // No session token found but user is authenticated via Supabase cookies
  // This is fine for page loads — Supabase handles its own cookie-based auth
  // For API routes, we still allow it since Supabase auth handles it
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Apply to all routes except static assets
    '/((?!_next/static|_next/image|favicon.ico|fonts/|images/).*)',
  ],
}
