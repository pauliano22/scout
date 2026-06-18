'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from '@/components/Link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, User, ArrowRight, GraduationCap, Briefcase, Check } from 'lucide-react'
import ScoutLogo from '@/components/ScoutLogo'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!role) {
      setError('Please choose how you want to join.')
      return
    }
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

      if (data.user && role === 'alumni') {
        await supabase
          .from('profiles')
          .update({ account_role: 'alumni', is_alumni: true })
          .eq('id', data.user.id)
      }

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
      <main className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md animate-fade-in-up">
          <ScoutLogo size="lg" className="justify-center mb-12" />

          <div className="card">
            <h1 className="text-xl font-semibold text-center mb-2">How do you want to join?</h1>
            <p className="text-[--text-tertiary] text-sm text-center mb-10">
              Pick one — you can always reach out to us if you need to switch later.
            </p>

            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setRole('student')}
                className="w-full text-left card-interactive flex items-start gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[--school-primary]/10 flex items-center justify-center flex-shrink-0">
                  <GraduationCap size={20} className="text-[--school-primary]" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[--text-primary]">Join as Student-Athlete</div>
                  <div className="text-xs text-[--text-tertiary] mt-1.5">
                    Discover alumni, plan outreach, and grow your network.
                  </div>
                </div>
                <ArrowRight size={16} className="text-[--text-quaternary] group-hover:text-[--school-primary] mt-2 flex-shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setRole('alumni')}
                className="w-full text-left card-interactive flex items-start gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[--school-primary]/10 flex items-center justify-center flex-shrink-0">
                  <Briefcase size={20} className="text-[--school-primary]" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[--text-primary]">Join as Alumni</div>
                  <div className="text-xs text-[--text-tertiary] mt-1.5">
                    Claim your profile and help current Cornell student-athletes.
                  </div>
                </div>
                <ArrowRight size={16} className="text-[--text-quaternary] group-hover:text-[--school-primary] mt-2 flex-shrink-0" />
              </button>
            </div>

            <div className="mt-8 text-center text-[--text-tertiary] text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-[--school-primary] hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ─── Step 2: Account form ────────────────────────────────────────
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md animate-fade-in-up">
        <ScoutLogo size="lg" className="justify-center mb-12" />

        <div className="card">
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
          <div className="flex items-center gap-2 mb-8 text-xs text-[--text-tertiary]">
            <Check size={13} className="text-emerald-500" />
            Joining as <span className="font-medium text-[--text-secondary]">
              {role === 'alumni' ? 'Alumni' : 'Student-Athlete'}
            </span>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3.5 text-red-400 text-sm">
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
              <p className="text-xs text-[--text-quaternary] mt-1.5 ml-1">
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
              className="w-full btn-primary flex items-center justify-center gap-2 py-3"
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

          <div className="mt-8 text-center text-[--text-tertiary] text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-[--school-primary] hover:underline">
              Sign in
            </Link>
          </div>
        </div>

        <p className="text-center text-[--text-quaternary] text-xs mt-8">
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
