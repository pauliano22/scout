import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import PlanClient from './PlanClient'
import SearchClient from './SearchClient'
import { isInAlumniSearchTreatment } from '@scout/shared/featureFlags/alumniSearch'
import { getSearchSuggestions } from '@/lib/search/suggestions'
import { sanitizeAlumniForStudent } from '@/lib/privacy/sanitizeAlumni'

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

  // Conversational search replaces the structured Plan for users in the
  // rollout (ALUMNI_SEARCH_ROLLOUT_PERCENT, env-overridable). Control arm keeps
  // the old Plan UI as a fallback.
  const inSearchTreatment = isInAlumniSearchTreatment(user.id)

  // Fetch the active plan only for the control arm (search doesn't use it).
  const { data: activePlan } = inSearchTreatment
    ? { data: null }
    : await supabase
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

  // Dynamic suggestion cards for the search landing (treatment arm only).
  // Always resolves to exactly four strings, falling back to static examples.
  const searchSuggestions = inSearchTreatment
    ? await getSearchSuggestions({ userId: user.id, profile, supabase })
    : []

  // Sort plan alumni by sort_order; consent gate at egress (student page).
  if (activePlan?.plan_alumni) {
    activePlan.plan_alumni.sort((a: any, b: any) => a.sort_order - b.sort_order)
    activePlan.plan_alumni = activePlan.plan_alumni.map((pa: any) =>
      pa?.alumni ? { ...pa, alumni: sanitizeAlumniForStudent(pa.alumni) } : pa
    )
  }

  return (
    <>
      <Navbar
        user={{ email: user.email!, full_name: profile?.full_name }}
        networkCount={networkCount || 0}
      />
      {inSearchTreatment ? (
        <SearchClient
          userId={user.id}
          profile={profile}
          networkAlumniIds={networkAlumniIds}
          suggestions={searchSuggestions}
        />
      ) : (
        <PlanClient
          userId={user.id}
          profile={profile}
          plan={activePlan}
          stats={{
            networkCount: networkCount || 0,
            messagesCount: messagesCount || 0,
            meetingsCount: meetingsCount || 0,
          }}
          networkAlumniIds={networkAlumniIds}
        />
      )}
    </>
  )
}
