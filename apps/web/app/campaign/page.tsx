import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import MascotFeedback from '@/components/MascotFeedback'
import CampaignClient from './CampaignClient'
import { isInCampaignHome } from '@scout/shared/featureFlags/campaignHome'
import type { UserRole } from '@scout/shared/types/database'

// The agentic campaign home — the student's default landing when the
// CAMPAIGN_HOME_ROLLOUT flag is on for them. Students only; everyone else (and
// flagged-off students) is sent back to their normal home. The autonomous loop
// stays separately gated by AGENT_PILOT_USER_IDS — this is just the surface.
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
  if (role !== 'student' || !isInCampaignHome(user.id)) {
    redirect(role === 'alumni' ? '/profile' : role === 'admin' ? '/admin' : '/plan')
  }

  const { count: networkCount } = await supabase
    .from('user_networks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (
    <>
      <Navbar
        user={{ email: user.email!, full_name: profile?.full_name }}
        networkCount={networkCount || 0}
        role={role}
      />
      <CampaignClient profile={profile} />
      <MascotFeedback />
    </>
  )
}
