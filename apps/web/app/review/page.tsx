'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ScoutLogo from '@/components/ScoutLogo'
import { Clock, LogOut } from 'lucide-react'

export default function ReviewPendingPage() {
  const supabase = createClient()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
    } finally {
      window.location.href = '/'
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="h-1 w-16 mx-auto mb-6 rounded-full bg-[--accent-warm]" />
        <ScoutLogo size="lg" className="justify-center mb-10" />

        <div className="relative bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8 overflow-hidden">
          <div className="w-14 h-14 rounded-full bg-[--school-primary]/10 flex items-center justify-center mx-auto mb-5">
            <Clock size={26} className="text-[--school-primary]" />
          </div>
          <h1 className="text-2xl font-semibold text-[--text-primary] mb-3">
            Your account is under review
          </h1>
          <p className="text-[--text-secondary] leading-relaxed">
            We couldn&apos;t match your name to the Cornell Athletics roster automatically,
            so a real person is taking a quick look before your profile goes live.
          </p>
          <p className="text-[--text-tertiary] text-sm mt-4 leading-relaxed">
            Nothing else to do. You can close this tab and sign back in once
            you&apos;re approved.
          </p>

          <button
            onClick={signOut}
            disabled={signingOut}
            className="btn-secondary inline-flex items-center gap-2 mt-7 disabled:opacity-50"
          >
            <LogOut size={15} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>

        <p className="text-center text-[--text-quaternary] text-xs mt-6">
          Think this is a mistake? Reach out and we&apos;ll sort it out.
        </p>
      </div>
    </main>
  )
}
