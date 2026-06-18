'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from '@/components/Link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, User, ArrowRight, GraduationCap, Briefcase, Check } from 'lucide-react'
import ScoutLogo from '@/components/ScoutLogo'
import OnboardingVideo from './OnboardingVideo'

type Role = 'student' | 'alumni'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const initialRole: Role | null =
    searchParams.get('role') === 'alumni'
      ? 'alumni'
      : searchParams.get('role') === 'student'
        ? 'student'
        : null

  const [role, setRole] = useState<Role | null>(initialRole)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const next: Role | null =
      searchParams.get('role') === 'alumni'
        ? 'alumni'
        : searchParams.get('role') === 'student'
          ? 'student'
          : null
    if (next && next !== role) setRole(next)
    // Only react to URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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

    setIsLoading(true)

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
        <div className="w-full max-w-4xl">
          {/* Warm beige accent bar at top */}
          <div className="h-1 w-16 mx-auto mb-6 rounded-full bg-[--accent-warm]" />

          <ScoutLogo size="lg" className="justify-center mb-10" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Onboarding video — full-width on mobile, left column on md+ */}
            <Suspense fallback={<div className="aspect-video rounded-xl bg-[--bg-tertiary] animate-pulse" />}>
              <OnboardingVideo />
            </Suspense>

            <div className="relative bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8 overflow-hidden">
              {/* Cornell 'C' watermark */}
              <div
                className="absolute -bottom-4 -right-4 text-[--accent-warm-muted] select-none pointer-events-none text-[100px] font-bold leading-none opacity-30"
                aria-hidden="true"
              >
                C
              </div>

              <div className="relative z-10">
              <h1 className="text-xl font-semibold text-center mb-2">How do you want to join?</h1>
              <p className="text-[--text-tertiary] text-sm text-center mb-8">
                Pick one — you can always reach out to us if you need to switch later.
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className="w-full text-left bg-[--bg-primary] hover:bg-[--bg-tertiary] border border-[--border-primary] hover:border-[--school-primary] transition rounded-xl p-5 flex items-start gap-4 group"
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
                  className="w-full text-left bg-[--bg-primary] hover:bg-[--bg-tertiary] border border-[--border-primary] hover:border-[--school-primary] transition rounded-xl p-5 flex items-start gap-4 group"
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

        <div className="relative bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8 overflow-hidden">
          {/* Cornell 'C' watermark */}
          <div
            className="absolute -bottom-4 -right-4 text-[--accent-warm-muted] select-none pointer-events-none text-[100px] font-bold leading-none opacity-30"
            aria-hidden="true"
          >
            C
          </div>

          <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-semibold">Create your account</h1>
            <button
              type="button"
              onClick={() => setRole(null)}
              className="text-xs text-[--text-tertiary] hover:text-[--text-secondary] underline"
            >
              Change
            </button>
          </div>
          <div className="flex items-center gap-2 mb-6 text-xs text-[--text-tertiary]">
            <Check size={13} className="text-emerald-500" />
            Joining as <span className="font-medium text-[--text-secondary]">
              {role === 'alumni' ? 'Alumni' : 'Student-Athlete'}
            </span>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
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
          By signing up, you agree to our Terms of Service and Privacy Policy
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
