import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/requestAuth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCircleDataset, seasonsShared } from '@/lib/alumni-circle'
import LandingBeacon from './LandingBeacon'
import type { ReferralLink } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'

interface InvitePageProps {
  params: { code: string }
  searchParams: { for?: string }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).map(w => w.replace(/[^\p{L}]/gu, '')).filter(Boolean)
  if (!parts.length) return '?'
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
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

  // Prefilled claim variant: ?for=<alumniId> shows the invitee their own
  // unclaimed listing. Roster-public facts only (name, sport, class year) —
  // never photo/email/linkedin on an anonymous page.
  let invitee: { id: string; name: string; sport: string | null; year: number | null } | null = null
  let overlapLine: string | null = null
  const forId = searchParams.for?.trim()
  if (forId && /^[0-9a-f-]{36}$/i.test(forId)) {
    let { data: row } = await db
      .from('alumni')
      .select('id, full_name, sport, graduation_year, is_claimed, is_public, merged_into_id')
      .eq('id', forId)
      .maybeSingle()
    if (row?.merged_into_id) {
      const { data: canonical } = await db
        .from('alumni')
        .select('id, full_name, sport, graduation_year, is_claimed, is_public, merged_into_id')
        .eq('id', row.merged_into_id)
        .maybeSingle()
      row = canonical ?? row
    }
    if (row && row.is_public && !row.is_claimed && row.full_name?.trim()) {
      invitee = {
        id: row.id,
        name: row.full_name.trim(),
        sport: row.sport ?? null,
        year: row.graduation_year ?? null,
      }
      // "your teammate for N seasons" when both sides resolve in the circle
      // dataset; a broken dataset must never take down the landing.
      if (profile?.alumni_id) {
        try {
          const ds = await getCircleDataset()
          const ego = ds.byId.get(profile.alumni_id)
          const them = ds.byId.get(row.id)
          if (ego && them) {
            const seasons = seasonsShared(ego, them)
            if (seasons > 0) {
              overlapLine = `your teammate for ${seasons} season${seasons === 1 ? '' : 's'}`
            } else if (
              ego.a != null && them.a != null &&
              Math.max(ego.a, them.a) < Math.min(ego.b!, them.b!)
            ) {
              overlapLine = 'on campus with you'
            }
          }
        } catch {
          /* landing renders without the overlap line */
        }
      }
    }
  }

  // Check if current user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-12">
      <LandingBeacon hasFor={!!invitee} />
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src="/favicon.svg" alt="Scout" className="w-9 h-9" />
          <span className="text-xl font-bold tracking-tight text-gray-900">Scout</span>
        </div>

        {invitee ? (
          <>
            {/* Prefilled claim variant: show the invitee their own listing. */}
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-4">
              Your profile is waiting
            </p>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">This is you on Scout</h1>

            <div className="flex items-center gap-4 bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6 text-left">
              <div className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-semibold bg-[#B31B1B]/10 text-[#8a3033]">
                {initials(invitee.name)}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-gray-900 truncate">{invitee.name}</p>
                <p className="text-sm text-gray-500">
                  {[invitee.sport, invitee.year ? `Class of ’${String(invitee.year).slice(-2)}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'Cornell athlete'}
                </p>
              </div>
            </div>

            <p className="text-base text-gray-600 mb-8">
              <span className="font-semibold text-gray-900">{displayName}</span>
              {overlapLine ? <> — {overlapLine} — </> : ' '}
              invited you to claim it.
            </p>
          </>
        ) : (
          <>
            {/* Headline */}
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Join the Cornell athlete alumni network
            </h1>

            <p className="text-lg text-gray-600 mb-8">
              Invited by <span className="font-semibold text-gray-900">{displayName}</span>
              {displaySport && <> · {displaySport}</>}
              {displayYear && <> &apos;{String(displayYear).slice(-2)}</>}
            </p>
          </>
        )}

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
              href={invitee ? `/signup?role=alumni&ref=${code}&for=${invitee.id}` : `/signup?ref=${code}`}
              className="block w-full bg-[#B31B1B] hover:bg-[#8B1515] text-white font-semibold py-3 px-6 rounded-xl transition-colors text-center"
            >
              {invitee ? 'Claim your profile' : 'Sign Up & Join'}
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
