'use client'

import { useEffect, useState, Suspense } from 'react'
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
        : null

  const [role, setRole] = useState<Role | null>(initialRole)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const next: Role | null =
      searchParams?.get('role') === 'alumni'
        ? 'alumni'
        : searchParams?.get('role') === 'student'
          ? 'student'
          : null
    if (next && next !== role) setRole(next)
    // Only react to URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Funnel: page reached, then form shown once a role is picked. Duplicate
  // step events are fine — funnel stats count unique sessions per step.
  useEffect(() => {
    logSignupStep('landing')
  }, [])
  useEffect(() => {
    if (role) logSignupStep('form', { role })
  }, [role])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!role) {
      setError('Please choose how you want to join.')
      return
    }
    // Students must use @cornell.edu so we can verify them. Alumni can use any email.
    if (role === 'student' && !email.toLowerCase().endsWith('@cornell.edu')) {
      setError('Please use your Cornell email address (@cornell.edu)')
      return
    }
    if (!agreedToTerms) {
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
      router.push('/onboarding')
    } catch (err: any) {
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
                onClick={() => setRole('student')}
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
                onClick={() => setRole('alumni')}
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

          <form onSubmit={handleSignup} className="space-y-4">
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
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="input-field !pl-11"
                />
              </div>
              <p className="text-xs text-[--text-quaternary] mt-1 ml-1">
                {role === 'alumni'
                  ? 'Personal or work email is fine.'
                  : 'Use your Cornell email (@cornell.edu)'}
              </p>
            </div>

            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none"
              />
              <input
                type="password"
                placeholder="Password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
                className="input-field !pl-11"
              />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                required
                disabled={isLoading}
                className="mt-0.5 w-4 h-4 accent-[--school-primary] flex-shrink-0 cursor-pointer"
              />
              <span className="text-xs text-[--text-tertiary] leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" className="text-[--school-primary] hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-[--school-primary] hover:underline">
                  Privacy Policy
                </Link>
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
          <Link href="/terms" className="underline hover:text-[--text-tertiary]">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-[--text-tertiary]">
            Privacy Policy
          </Link>
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
