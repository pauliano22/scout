import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import DiscoverClient, { DiscoverAlumni } from './DiscoverClient'

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

  // Fetch ALL alumni - only select needed fields for performance
  const { data: alumni, error: alumniError } = await supabase
    .from('alumni')
    .select('id, full_name, company, role, industry, sport, graduation_year, linkedin_url, location')
    .eq('is_public', true)
    .order('graduation_year', { ascending: false })
    .limit(30000)

  // Sort alumni to prioritize those with career info
  // Sort alumni to prioritize those with industry info
  const sortedAlumni = ((alumni || []) as DiscoverAlumni[]).sort((a, b) => {
    const aHasInfo = a.industry && a.industry.trim() !== ''
    const bHasInfo = b.industry && b.industry.trim() !== ''

    // Prioritize those with industry info
    if (aHasInfo && !bHasInfo) return -1
    if (!aHasInfo && bHasInfo) return 1

    // Then sort by graduation year (most recent first)
    return (b.graduation_year || 0) - (a.graduation_year || 0)
  })

  // Fetch user's network to know which alumni are already added
  const { data: network } = await supabase
    .from('user_networks')
    .select('alumni_id')
    .eq('user_id', user.id)

  const networkAlumniIds = new Set(network?.map(n => n.alumni_id) || [])
  const networkCount = networkAlumniIds.size

  if (alumniError) {
    console.error('Error fetching alumni:', alumniError)
  }

  return (
    <>
      <Navbar
        user={{ email: user.email! }}
        networkCount={networkCount}
      />
      <DiscoverClient
        initialAlumni={sortedAlumni}
        networkAlumniIds={Array.from(networkAlumniIds)}
        userId={user.id}
        userSport={profile?.sport || null}
        totalAlumniCount={sortedAlumni.length}
      />
    </>
  )
}