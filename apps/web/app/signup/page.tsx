'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import Link from '@/components/Link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, User, ArrowRight, GraduationCap, Briefcase } from 'lucide-react'
import ScoutLogo from '@/components/ScoutLogo'
import { logSignupStep } from '@/lib/signupFunnel'

type Role = 'student' | 'alumni'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const initialRole: Role | null =
    searchParams?.get('role') === 'alumni'
      ? 'alumni'
      : searchParams?.get('role') === 'student'
        ? 'student'
        : searchParams?.get('for')
          ? 'alumni' // claim links are alumni by definition
          : null

  const [role, setRole] = useState<Role | null>(initialRole)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // Early, non-blocking nudge for students typing a non-Cornell address —
  // the hard gate at submit was invisible until they tapped Create Account.
  const [showCornellHint, setShowCornellHint] = useState(false)

  // Once-per-mount diagnostic emits (see migration 068).
  const engagedLogged = useRef(false)
  const nativeBlockLogged = useRef(false)
  // Whether the current role came from the URL (?role= deep link) or a click —
  // the URL param lingers after "Change", so it can't be read at log time.
  const roleSource = useRef<'url' | 'click'>(initialRole ? 'url' : 'click')
  const markEngaged = () => {
    if (engagedLogged.current) return
    engagedLogged.current = true
    logSignupStep('form_engaged', { role })
  }

  useEffect(() => {
    const next: Role | null =
      searchParams?.get('role') === 'alumni'
        ? 'alumni'
        : searchParams?.get('role') === 'student'
          ? 'student'
          : null
    if (next && next !== role) {
      roleSource.current = 'url'
      setRole(next)
    }
    // Only react to URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Funnel: page reached, then form shown once a role is picked. Duplicate
  // step events are fine — funnel stats count unique sessions per step.
  // 'form' fires on mount for ?role= deep links (all ad traffic), so
  // metadata.source distinguishes a deep-link pageview from a real role click;
  // form_engaged (first field focus) is the actual engagement signal.
  useEffect(() => {
    logSignupStep('landing', { referrer: document.referrer.slice(0, 300) || undefined })
  }, [])

  // Referral relay: /r/[code] passes ?ref= (and ?for= on prefilled claim
  // links). Stash them for the post-signup flow — sessionStorage survives the
  // /onboarding redirect. Redemption fires after signup (students) or after a
  // completed claim (alumni, with connected_alumni_id attached).
  useEffect(() => {
    const ref = searchParams?.get('ref')?.trim()
    const forAlumniId = searchParams?.get('for')?.trim()
    if (!ref && !forAlumniId) return
    try {
      const prev = JSON.parse(sessionStorage.getItem('scout-referral') ?? '{}')
      sessionStorage.setItem('scout-referral', JSON.stringify({
        code: ref || prev.code || null,
        forAlumniId: forAlumniId || prev.forAlumniId || null,
      }))
    } catch { /* storage unavailable — flow degrades to the normal wizard */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  useEffect(() => {
    if (role) logSignupStep('form', { role, source: roleSource.current })
  }, [role])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Every rejected attempt logs submit_blocked — before this, validation
    // failures were indistinguishable from bounces in the funnel.
    if (!role) {
      logSignupStep('submit_blocked', { reason: 'role_missing' })
      setError('Please choose how you want to join.')
      return
    }
    // Students must use @cornell.edu so we can verify them. Alumni can use any email.
    if (role === 'student' && !email.toLowerCase().endsWith('@cornell.edu')) {
      logSignupStep('submit_blocked', { role, reason: 'cornell_email', email_domain: email.split('@')[1]?.toLowerCase() ?? '' })
      setError('Please use your Cornell email address (@cornell.edu)')
      return
    }
    if (!agreedToTerms) {
      logSignupStep('submit_blocked', { role, reason: 'terms_unchecked' })
      setError('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }

    setIsLoading(true)
    // Email in metadata is what the abandoned-registration recovery cron
    // uses to reach people who submit but never complete.
    logSignupStep('submit', { role, email })

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            account_role: role,
          },
        },
      })

      if (error) throw error

      // Set the role on the profile after signup. The DB trigger creates a
      // baseline profile row with default role; this updates it to match
      // what the user picked. Best-effort — failure here doesn't block signup.
      if (data.user && role === 'alumni') {
        await supabase
          .from('profiles')
          .update({ account_role: 'alumni', is_alumni: true })
          .eq('id', data.user.id)
      }

      // Log signup activity (best-effort)
      fetch('/api/activity/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          metadata: { role, full_name: fullName },
        }),
      }).catch(() => {})

      logSignupStep('complete', { role })

      // Students redeem the referral now; alumni redeem after a completed
      // claim so the redemption carries connected_alumni_id. Fire-and-forget:
      // self/duplicate codes 4xx harmlessly and never block signup.
      if (role === 'student') {
        try {
          const stored = JSON.parse(sessionStorage.getItem('scout-referral') ?? '{}')
          if (stored.code) {
            fetch('/api/referral/redeem', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: stored.code }),
            }).catch(() => {})
            sessionStorage.removeItem('scout-referral')
          }
        } catch { /* ignore */ }
      }

      router.push('/onboarding')
    } catch (err: any) {
      logSignupStep('submit_blocked', { role, reason: 'auth_error', message: String(err?.message ?? '').slice(0, 120) })
      setError(err.message || 'Failed to sign up')
      setIsLoading(false)
    }
  }

  // ─── Step 1: Role selection ──────────────────────────────────────
  if (!role) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Warm beige accent bar at top */}
          <div className="h-1 w-16 mx-auto mb-6 rounded-full bg-[--accent-warm]" />

          <ScoutLogo size="lg" className="justify-center mb-10" />

          <div className="relative p-2 sm:p-4">
            <div className="relative z-10">
            <h1 className="text-xl font-semibold text-center mb-8">How do you want to join?</h1>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { roleSource.current = 'click'; setRole('student') }}
                className="w-full text-left bg-[--bg-secondary] hover:bg-[--bg-tertiary] shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)] transition rounded-2xl p-5 flex items-start gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[--school-primary]/10 flex items-center justify-center flex-shrink-0">
                  <GraduationCap size={20} className="text-[--school-primary]" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[--text-primary]">Join as Student-Athlete</div>
                  <div className="text-xs text-[--text-tertiary] mt-1">
                    Discover alumni, plan outreach, and grow your network.
                  </div>
                </div>
                <ArrowRight size={16} className="text-[--text-quaternary] group-hover:text-[--school-primary] mt-3" />
              </button>

              <button
                type="button"
                onClick={() => { roleSource.current = 'click'; setRole('alumni') }}
                className="w-full text-left bg-[--bg-secondary] hover:bg-[--bg-tertiary] shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)] transition rounded-2xl p-5 flex items-start gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[--school-primary]/10 flex items-center justify-center flex-shrink-0">
                  <Briefcase size={20} className="text-[--school-primary]" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[--text-primary]">Join as Alumni</div>
                  <div className="text-xs text-[--text-tertiary] mt-1">
                    Claim your profile and help current Cornell student-athletes.
                  </div>
                </div>
                <ArrowRight size={16} className="text-[--text-quaternary] group-hover:text-[--school-primary] mt-3" />
              </button>
            </div>

            <div className="mt-6 text-center text-[--text-tertiary] text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-[--school-primary] hover:underline">
                Sign in
              </Link>
            </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ─── Step 2: Account form ────────────────────────────────────────
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Warm beige accent bar at top */}
        <div className="h-1 w-16 mx-auto mb-6 rounded-full bg-[--accent-warm]" />

        <ScoutLogo size="lg" className="justify-center mb-10" />

        <div className="relative bg-[--bg-secondary] shadow-[var(--shadow-soft)] rounded-xl p-8 overflow-hidden">
          {/* Cornell 'C' watermark */}
          <div
            className="absolute -bottom-4 -right-4 text-[--accent-warm-muted] select-none pointer-events-none text-[100px] font-bold leading-none opacity-30"
            aria-hidden="true"
          >
            C
          </div>

          <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold">
              Create your {role === 'alumni' ? 'alumni' : 'student-athlete'} account
            </h1>
            <button
              type="button"
              onClick={() => setRole(null)}
              className="text-xs text-[--text-tertiary] hover:text-[--text-secondary] underline shrink-0 ml-3"
            >
              Change
            </button>
          </div>

          <form
            onSubmit={handleSignup}
            // First focus on any field = real engagement (vs the mount-fired
            // 'form' step); native validation bubbles (required/minLength)
            // block submission before handleSignup, so log those too.
            onFocusCapture={markEngaged}
            onInvalidCapture={(e) => {
              if (nativeBlockLogged.current) return
              nativeBlockLogged.current = true
              const t = e.target as HTMLInputElement
              logSignupStep('submit_blocked', { role, reason: 'native_validation', field: t?.name || t?.type || 'unknown' })
            }}
            className="space-y-4"
          >
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="relative">
              <User
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none"
              />
              <input
                type="text"
                name="full_name"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
                className="input-field !pl-11"
              />
            </div>

            <div>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none"
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setShowCornellHint(false) }}
                  onBlur={() => setShowCornellHint(role === 'student' && email.includes('@') && !email.toLowerCase().endsWith('@cornell.edu'))}
                  required
                  disabled={isLoading}
                  className="input-field !pl-11"
                />
              </div>
              {role === 'student' && showCornellHint ? (
                <p className="text-xs text-amber-500 mt-1 ml-1">
                  Students sign up with their @cornell.edu email — it&apos;s how we match you to your team.
                </p>
              ) : (
                <p className="text-xs text-[--text-quaternary] mt-1 ml-1">
                  {role === 'alumni'
                    ? 'Personal or work email is fine.'
                    : 'Use your Cornell email (@cornell.edu)'}
                </p>
              )}
            </div>

            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none"
              />
              <input
                type="password"
                name="password"
                placeholder="Password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
                className="input-field !pl-11"
              />
            </div>

            {/* Legal links open in a new tab with plain anchors: the custom
                Link client-navigates away and destroys everything typed. The
                padded label keeps the tap target ≥44px on narrow WebViews. */}
            <label className="flex items-start gap-3 cursor-pointer py-2">
              {/* Deliberately NOT `required`: the native bubble would block
                  submission before handleSignup, hiding the styled error and
                  misfiling the block as native_validation instead of
                  terms_unchecked in the funnel diagnostics. */}
              <input
                type="checkbox"
                name="terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                aria-required="true"
                disabled={isLoading}
                className="mt-0.5 w-5 h-5 accent-[--school-primary] flex-shrink-0 cursor-pointer"
              />
              <span className="text-xs text-[--text-tertiary] leading-relaxed">
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[--school-primary] hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[--school-primary] hover:underline">
                  Privacy Policy
                </a>
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-[--text-tertiary] text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-[--school-primary] hover:underline">
              Sign in
            </Link>
          </div>
          </div>
        </div>

        <p className="text-center text-[--text-quaternary] text-xs mt-6">
          By signing up, you agree to our{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-[--text-tertiary]">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-[--text-tertiary]">
            Privacy Policy
          </a>
        </p>
      </div>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <SignupForm />
    </Suspense>
  )
}
