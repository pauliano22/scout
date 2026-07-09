import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/requestAuth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { ReferralLink } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'

interface InvitePageProps {
  params: { code: string }
}

export default async function InvitePage({ params }: InvitePageProps) {
  const supabase = createClient()

  // Data reads use the service client: the visitor is usually logged out, and
  // RLS lets only the OWNER read a referral_links row, so the cookie client
  // 404'd this page for the exact people the link is for.
  const db = serviceClient()

  const code = params.code.toUpperCase().trim()

  // Look up the referral link
  const { data: referralLink } = await db
    .from('referral_links')
    .select('id, user_id')
    .eq('code', code)
    .eq('is_active', true)
    .single()

  if (!referralLink) {
    notFound()
  }

  // Get the referrer's profile and alumni info
  const { data: profile } = await db
    .from('profiles')
    .select('full_name, sport, graduation_year, company, role, alumni_id')
    .eq('id', referralLink.user_id)
    .single()

  const referrerName = profile?.full_name || 'A fellow athlete'
  const referrerSport = profile?.sport || ''
  const referrerGradYear = profile?.graduation_year || ''

  // If they have an alumni record, use that for richer info
  let alumniRecord = null
  if (profile?.alumni_id) {
    const { data: alumni } = await db
      .from('alumni')
      .select('full_name, sport, graduation_year')
      .eq('id', profile.alumni_id)
      .single()
    alumniRecord = alumni
  }

  const displayName = alumniRecord?.full_name || referrerName
  const displaySport = alumniRecord?.sport || referrerSport
  const displayYear = alumniRecord?.graduation_year || referrerGradYear

  // Check if current user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src="/favicon.svg" alt="Scout" className="w-9 h-9" />
          <span className="text-xl font-bold tracking-tight text-gray-900">Scout</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Join the Cornell athlete alumni network
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          Invited by <span className="font-semibold text-gray-900">{displayName}</span>
          {displaySport && <> · {displaySport}</>}
          {displayYear && <> &apos;{String(displayYear).slice(-2)}</>}
        </p>

        {/* CTA */}
        {user ? (
          <form action="/api/referral/redeem" method="POST" className="space-y-3">
            <input type="hidden" name="code" value={code} />
            <button
              type="submit"
              className="w-full bg-[#B31B1B] hover:bg-[#8B1515] text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Join the Network
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <Link
              href={`/signup?ref=${code}`}
              className="block w-full bg-[#B31B1B] hover:bg-[#8B1515] text-white font-semibold py-3 px-6 rounded-xl transition-colors text-center"
            >
              Sign Up &amp; Join
            </Link>
            <Link
              href={`/login?ref=${code}`}
              className="block w-full border border-gray-200 hover:border-gray-300 text-gray-700 font-medium py-3 px-6 rounded-xl transition-colors text-center"
            >
              Log in
            </Link>
          </div>
        )}

        {/* Footer */}
        <p className="mt-6 text-xs text-gray-400">
          By joining, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
