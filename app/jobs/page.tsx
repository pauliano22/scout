import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import JobsClient from './JobsClient'
import { Job } from '@/types/database'

export default async function JobsPage() {
  const supabase = createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, sport, industry, interests')
    .eq('id', user.id)
    .single()

  // Fetch network count for navbar
  const { data: network } = await supabase
    .from('user_networks')
    .select('alumni_id')
    .eq('user_id', user.id)

  const networkCount = network?.length || 0

  // Fetch initial jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(20)

  // Fetch user's saved/applied jobs
  const { data: interactions } = await supabase
    .from('user_job_interactions')
    .select('job_id, interaction_type')
    .eq('user_id', user.id)

  const savedJobIds = interactions
    ?.filter(i => i.interaction_type === 'saved')
    .map(i => i.job_id) || []

  const appliedJobIds = interactions
    ?.filter(i => i.interaction_type === 'applied')
    .map(i => i.job_id) || []

  return (
    <>
      <Navbar
        user={{ email: user.email!, full_name: profile?.full_name }}
        networkCount={networkCount}
      />
      <JobsClient
        initialJobs={(jobs || []) as Job[]}
        initialSavedIds={savedJobIds}
        initialAppliedIds={appliedJobIds}
        userId={user.id}
        userProfile={{
          sport: profile?.sport || null,
          industry: profile?.industry || null,
          interests: profile?.interests || null,
        }}
      />
    </>
  )
}
