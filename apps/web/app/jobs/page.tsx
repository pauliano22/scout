import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import JobsClient from './JobsClient'

export const dynamic = 'force-dynamic'

const INITIAL_PAGE_SIZE = 24

export default async function JobsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_role, sport')
    .eq('id', user.id)
    .single()

  const { data: jobs, count: totalCount } = await supabase
    .from('job_listings')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(0, INITIAL_PAGE_SIZE - 1)

  const { data: myApplications } = await supabase
    .from('job_applications')
    .select('job_listing_id')
    .eq('applicant_id', user.id)

  const appliedJobIds = new Set(myApplications?.map(a => a.job_listing_id) || [])
  const isAlumni = profile?.account_role === 'alumni'

  let myListings: any[] = []
  if (isAlumni) {
    const { data: listings } = await supabase
      .from('job_listings')
      .select('id, title, is_active, created_at')
      .eq('posted_by', user.id)
      .order('created_at', { ascending: false })

    if (listings) {
      const listingIds = listings.map(l => l.id)
      const { data: counts } = await supabase
        .from('job_applications')
        .select('job_listing_id')
        .in('job_listing_id', listingIds)

      const countMap = new Map<string, number>()
      counts?.forEach(a => countMap.set(a.job_listing_id, (countMap.get(a.job_listing_id) || 0) + 1))

      myListings = listings.map(l => ({ ...l, applicant_count: countMap.get(l.id) || 0 }))
    }
  }

  return (
    <>
      <Navbar user={{ email: user.email! }} />
      <JobsClient
        initialJobs={(jobs || []) as any[]}
        totalJobs={totalCount || 0}
        appliedJobIds={Array.from(appliedJobIds)}
        userSport={profile?.sport || null}
        userId={user.id}
        isAlumni={isAlumni}
        myListings={myListings}
      />
    </>
  )
}
