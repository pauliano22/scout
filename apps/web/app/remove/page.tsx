'use client'

import { useState } from 'react'
import Link from '@/components/Link'
import { Mail, User, Linkedin, ArrowRight, ShieldCheck } from 'lucide-react'
import ScoutLogo from '@/components/ScoutLogo'

export default function RemoveProfilePage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Please enter the full name on the profile.')
      return
    }
    if (!email.trim() && !linkedin.trim()) {
      setError('Please add the email or LinkedIn URL on the profile so we can find it.')
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/alumni/remove-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, linkedin_url: linkedin, reason }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.')
      setDone(json.data?.message || 'Your request has been received.')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="h-1 w-16 mx-auto mb-6 rounded-full bg-[--accent-warm]" />
        <ScoutLogo size="lg" className="justify-center mb-10" />

        <div className="relative bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8 overflow-hidden">
          <div className="relative z-10">
            {done ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[--school-primary]/10 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck size={22} className="text-[--school-primary]" />
                </div>
                <h1 className="text-xl font-semibold mb-3">Request received</h1>
                <p className="text-[--text-secondary] text-sm leading-relaxed">{done}</p>
                <Link href="/" className="inline-block mt-6 text-[--school-primary] hover:underline text-sm">
                  Back to home
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold mb-2">Remove my profile</h1>
                <p className="text-[--text-tertiary] text-sm leading-relaxed mb-6">
                  Scout maintains a directory of Cornell athlete alumni built from public
                  sources. If you&apos;d like your profile removed, tell us who you are below
                  and we&apos;ll hide it from the directory. No account needed.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Full name on the profile"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={isLoading}
                      className="input-field !pl-11"
                    />
                  </div>

                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
                    <input
                      type="email"
                      placeholder="Email on the profile"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="input-field !pl-11"
                    />
                  </div>

                  <div className="relative">
                    <Linkedin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
                    <input
                      type="url"
                      placeholder="LinkedIn URL (optional)"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      disabled={isLoading}
                      className="input-field !pl-11"
                    />
                  </div>

                  <p className="text-xs text-[--text-quaternary] -mt-1 ml-1">
                    Add your email or LinkedIn so we can match the right record.
                  </p>

                  <textarea
                    placeholder="Anything else you'd like us to know (optional)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={isLoading}
                    rows={3}
                    className="input-field resize-none"
                  />

                  <button type="submit" disabled={isLoading} className="w-full btn-primary flex items-center justify-center gap-2">
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit removal request
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-[--text-quaternary] text-xs mt-6">
          Questions? Contact us before submitting and we&apos;ll help.
        </p>
      </div>
    </main>
  )
}
