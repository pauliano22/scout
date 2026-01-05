import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import DiscoverClient from './DiscoverClient'

export default async function DiscoverPage() {
  const supabase = createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch ALL alumni (increase limit from default 1000)
  const { data: alumni, error: alumniError } = await supabase
    .from('alumni')
    .select('*')
    .eq('is_public', true)
    .order('graduation_year', { ascending: false })
    .limit(30000)

  // Sort alumni to prioritize those with career info
  const sortedAlumni = (alumni || []).sort((a, b) => {
    const aHasInfo = a.company && a.company.trim() !== ''
    const bHasInfo = b.company && b.company.trim() !== ''
    
    // Prioritize those with company info
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
      />
    </>
  )
}