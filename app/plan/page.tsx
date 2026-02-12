import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import PlanClient from './PlanClient'

export default async function PlanPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch profile and check onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  // Fetch active plan with plan_alumni joined with alumni data
  const { data: activePlan } = await supabase
    .from('networking_plans')
    .select(`
      *,
      plan_alumni (
        *,
        alumni (*)
      )
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Fetch custom contacts for the active plan
  let customContacts: any[] = []
  if (activePlan) {
    const { data: contacts } = await supabase
      .from('plan_custom_contacts')
      .select('*')
      .eq('plan_id', activePlan.id)
      .order('created_at', { ascending: true })

    customContacts = contacts || []
  }

  // Fetch stats
  const { count: networkCount } = await supabase
    .from('user_networks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: messagesCount } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: meetingsCount } = await supabase
    .from('user_networks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['meeting_scheduled', 'met'])

  // Fetch network alumni IDs (for showing "In Network" badges)
  const { data: networkAlumni } = await supabase
    .from('user_networks')
    .select('alumni_id')
    .eq('user_id', user.id)

  const networkAlumniIds = networkAlumni?.map(n => n.alumni_id) || []

  // Sort plan alumni by sort_order
  if (activePlan?.plan_alumni) {
    activePlan.plan_alumni.sort((a: any, b: any) => a.sort_order - b.sort_order)
  }

  return (
    <>
      <Navbar
        user={{ email: user.email!, full_name: profile?.full_name }}
        networkCount={networkCount || 0}
      />
      <PlanClient
        userId={user.id}
        profile={profile}
        plan={activePlan}
        customContacts={customContacts}
        stats={{
          networkCount: networkCount || 0,
          messagesCount: messagesCount || 0,
          meetingsCount: meetingsCount || 0,
        }}
        networkAlumniIds={networkAlumniIds}
      />
    </>
  )
}
