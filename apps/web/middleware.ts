import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options: CookieOptions }

// Gate: an alumni account whose profile claim is still pending review
// (onboarding done, but directory_access not yet granted) is redirected to
// /review — they can't browse the app until an admin approves them.
//
// FAIL-OPEN by design: any error here returns the request untouched, so a bug
// in this middleware can never take the site down.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            )
          },
        },
      },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return response

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_role, directory_access, onboarding_completed')
      .eq('id', user.id)
      .single()

    const isPendingAlum =
      profile?.account_role === 'alumni' &&
      profile?.onboarding_completed === true &&
      profile?.directory_access !== true

    if (isPendingAlum) {
      const url = request.nextUrl.clone()
      url.pathname = '/review'
      return NextResponse.redirect(url)
    }
  } catch {
    // Never break the site on a middleware error.
    return response
  }

  return response
}

// Run on app pages only — skip API routes, static assets, auth surfaces, the
// onboarding wizard (alumni finish their claim there), the /review page itself,
// referral redemption links, and the always-public legal pages.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|favicon.svg|login|signup|onboarding|review|auth|privacy|terms|remove|r/).*)',
  ],
}
