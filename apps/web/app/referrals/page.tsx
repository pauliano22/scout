import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ReferralProgressTracker from '@/components/ReferralProgressTracker'
import ReferralLeaderboard from '@/components/ReferralLeaderboard'

export const dynamic = 'force-dynamic'

export default async function ReferralsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    <>
      <Navbar
        user={{ email: user.email!, full_name: profile?.full_name }}
        networkCount={0}
      />
      <main className="min-h-screen px-4 py-10">
        <div className="w-full max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">Referral Program</h1>
            <p className="text-gray-500 mt-1">
              Invite teammates to the network and climb the leaderboard.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Referral Progress Tracker */}
            <div>
              <ReferralProgressTracker />
            </div>

            {/* Right: Leaderboard */}
            <div>
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">🏆</span>
                  <h3 className="text-lg font-semibold text-gray-900">Leaderboard</h3>
                </div>
                <ReferralLeaderboard
                  limit={20}
                  currentUserId={user.id}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
