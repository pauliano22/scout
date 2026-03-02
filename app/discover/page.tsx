import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import DiscoverClient from './DiscoverClient'

const INITIAL_PAGE_SIZE = 50

export default async function DiscoverPage() {
  const supabase = createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile to get their sport
  const { data: profile } = await supabase
    .from('profiles')
    .select('sport')
    .eq('id', user.id)
    .single()

  // Fetch only the first page of alumni (sorted: industry first, then grad year)
  const { data: alumni, count: totalCount } = await supabase
    .from('alumni')
    .select('id, full_name, company, role, industry, sport, graduation_year, linkedin_url, location, avatar_url', { count: 'exact' })
    .eq('is_public', true)
    .order('industry', { ascending: false, nullsFirst: false })
    .order('graduation_year', { ascending: false })
    .range(0, INITIAL_PAGE_SIZE - 1)

  // Fetch user's network to know which alumni are already added
  const { data: network } = await supabase
    .from('user_networks')
    .select('alumni_id')
    .eq('user_id', user.id)

  const networkAlumniIds = new Set(network?.map(n => n.alumni_id) || [])
  const networkCount = networkAlumniIds.size

  return (
    <>
      <Navbar
        user={{ email: user.email! }}
        networkCount={networkCount}
      />
      <DiscoverClient
        initialAlumni={alumni || []}
        networkAlumniIds={Array.from(networkAlumniIds)}
        userId={user.id}
        userSport={profile?.sport || null}
        totalAlumniCount={totalCount || 0}
      />
    </>
  )
}
