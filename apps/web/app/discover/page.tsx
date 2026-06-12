import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import DiscoverClient from './DiscoverClient'

export const dynamic = 'force-dynamic'

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

  // Fetch only the first page of alumni — sorted by prestige (big companies, finance first)
  const { data: alumni, count: totalCount } = await supabase
    .from('alumni')
    .select('id, full_name, company, role, industry, sport, graduation_year, linkedin_url, location, photo_url, avatar_url, prestige_score', { count: 'exact' })
    .eq('is_public', true)
    .or('company.not.is.null,role.not.is.null')
    .order('prestige_score', { ascending: false, nullsFirst: false })
    .order('avatar_url', { ascending: false, nullsFirst: false })
    .order('role', { ascending: false, nullsFirst: false })
    .order('company', { ascending: false, nullsFirst: false })
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
