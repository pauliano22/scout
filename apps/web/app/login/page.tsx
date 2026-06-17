'use client'

import { useState } from 'react'
import Link from '@/components/Link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { postLoginPath } from '@/lib/auth/postLoginPath'
import type { UserRole } from '@scout/shared/types/database'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import ScoutLogo from '@/components/ScoutLogo'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      const userId = signInData.user?.id
      let dest = '/plan'
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_role, onboarding_completed')
          .eq('id', userId)
          .single()
        dest = postLoginPath(
          (profile?.account_role as UserRole | undefined) ?? 'student',
          Boolean(profile?.onboarding_completed),
          userId,
        )
      }

      router.push(dest)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Warm beige accent bar at top */}
        <div className="h-1 w-16 mx-auto mb-6 rounded-full bg-[--accent-warm]" />

        {/* Logo */}
        <ScoutLogo size="lg" className="justify-center mb-10" />

        {/* Login Card */}
        <div className="relative bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8 overflow-hidden">
          {/* Cornell 'C' watermark */}
          <div
            className="absolute -bottom-4 -right-4 text-[--accent-warm-muted] select-none pointer-events-none text-[100px] font-bold leading-none opacity-30"
            aria-hidden="true"
          >
            C
          </div>

          <div className="relative z-10">
          <h1 className="text-xl font-semibold text-center mb-2">Welcome back</h1>
          <p className="text-[--text-tertiary] text-sm text-center mb-8">
            Sign in to access your network
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field !pl-11"
              />
            </div>

            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field !pl-11"
              />
            </div>

            <div className="text-right">
              <Link href="/forgot-password" className="text-[--text-tertiary] text-sm hover:text-[--school-primary] transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-[--text-tertiary] text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[--school-primary] hover:underline">
              Sign up
            </Link>
          </div>
          </div>
        </div>

        <p className="text-center text-[--text-quaternary] text-xs mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </main>
  )
}