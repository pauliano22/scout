import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import CampaignClient from './CampaignClient'
import type { UserRole } from '@scout/shared/types/database'

// The agentic picks page — the single student home. Alumni/admin are routed to
// their own surfaces. The autonomous send-loop stays separately gated by
// AGENT_PILOT_USER_IDS; this is just the surface every student lands on.
export default async function CampaignPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_completed) redirect('/onboarding')

  const role = (profile?.account_role as UserRole | undefined) ?? 'student'
  if (role !== 'student') {
    redirect(role === 'alumni' ? '/profile' : role === 'admin' ? '/admin' : '/login')
  }

  const { count: networkCount } = await supabase
    .from('user_networks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // People who replied and are waiting on the student — surfaced as one quiet
  // line on the home so the highest-value action isn't buried in Network.
  const { count: waitingCount } = await supabase
    .from('user_networks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'response_needed')

  return (
    <>
      <Navbar
        user={{ email: user.email!, full_name: profile?.full_name }}
        networkCount={networkCount || 0}
        role={role}
      />
      <CampaignClient profile={profile} waitingCount={waitingCount || 0} />
    </>
  )
}
