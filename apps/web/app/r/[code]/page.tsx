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

  let referrerName = profile?.full_name || 'A fellow athlete'
  let referrerSport = profile?.sport || ''
  let referrerGradYear = profile?.graduation_year || ''
  let referrerCompany = profile?.company || null
  let referrerRole = profile?.role || null

  // If they have an alumni record, use that for richer info
  let alumniRecord = null
  if (profile?.alumni_id) {
    const { data: alumni } = await db
      .from('alumni')
      .select('full_name, sport, graduation_year, company, role, industry, photo_url')
      .eq('id', profile.alumni_id)
      .single()
    alumniRecord = alumni
  }

  const displayName = alumniRecord?.full_name || referrerName
  const displaySport = alumniRecord?.sport || referrerSport
  const displayYear = alumniRecord?.graduation_year || referrerGradYear
  const displayCompany = alumniRecord?.company || referrerCompany
  const displayRole = alumniRecord?.role || referrerRole

  // Check if current user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        {/* Logo */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-[#B31B1B] rounded-full flex items-center justify-center mx-auto">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
        </div>

        {/* Badge */}
        <div className="inline-block bg-red-50 text-[#B31B1B] text-xs font-semibold px-3 py-1 rounded-full mb-4">
          CORNELL ATHLETE NETWORK
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          You&apos;ve been invited!
        </h1>

        <p className="text-lg text-gray-600 mb-6">
          <span className="font-semibold text-gray-900">{displayName}</span>
          {displaySport && <> • {displaySport}</>}
          {displayYear && <> • {displayYear}</>}
          {displayRole && <>, {displayRole}</>}
          {displayCompany && <> at {displayCompany}</>}
          {' '}invited you to join the Cornell athlete alumni network.
        </p>

        {/* Value prop */}
        <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-[#B31B1B]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-[#B31B1B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Connect with 500+ athletes</p>
              <p className="text-sm text-gray-500">Find alumni in your industry, sport, and beyond.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-[#B31B1B]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-[#B31B1B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Discover opportunities</p>
              <p className="text-sm text-gray-500">Access jobs, internships, and mentorship from fellow Big Red.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-[#B31B1B]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-[#B31B1B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Track your progress</p>
              <p className="text-sm text-gray-500">Build your network with personalized recommendations.</p>
            </div>
          </div>
        </div>

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
