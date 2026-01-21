'use client'

import { useState } from 'react'
import Link from '@/components/Link'
import { createClient } from '@/lib/supabase/client'
import { Mail, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://scoutcornell.com/reset-password'
      })

      if (error) throw error

      setIsSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-10">
          <img src="/favicon.svg" alt="Scout" className="w-10 h-10" />
          <span className="logo-text text-xl">scout</span>
        </Link>

        {/* Card */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8">
          {isSuccess ? (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle size={48} className="text-green-500" />
              </div>
              <h1 className="text-xl font-semibold text-center mb-2">Check your email</h1>
              <p className="text-[--text-tertiary] text-sm text-center mb-6">
                We've sent a password reset link to <span className="text-[--text-primary]">{email}</span>.
                Click the link in the email to reset your password.
              </p>
              <Link
                href="/login"
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} />
                Back to Sign In
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-center mb-2">Forgot password?</h1>
              <p className="text-[--text-tertiary] text-sm text-center mb-8">
                Enter your email and we'll send you a reset link
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-[--text-tertiary] text-sm hover:text-[--school-primary] transition-colors inline-flex items-center gap-1">
                  <ArrowLeft size={14} />
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
