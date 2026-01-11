import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import CoachClient from './CoachClient'

export default async function CoachPage() {
  const supabase = createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch user's network count
  const { count: networkCount } = await supabase
    .from('user_networks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Fetch all alumni for recommendations
  const { data: alumni } = await supabase
    .from('alumni')
    .select('*')
    .eq('is_public', true)
    .not('company', 'is', null)
    .limit(5000)

  // Fetch user's existing network alumni IDs
  const { data: network } = await supabase
    .from('user_networks')
    .select('alumni_id')
    .eq('user_id', user.id)

  const networkAlumniIds = new Set(network?.map(n => n.alumni_id) || [])

  return (
    <>
      <Navbar 
        user={{ email: user.email!, full_name: profile?.full_name }} 
        networkCount={networkCount || 0}
      />
      <CoachClient 
        userId={user.id}
        userProfile={{
          name: profile?.full_name || '',
          sport: profile?.sport || '',
          interests: profile?.interests || '',
          graduationYear: profile?.graduation_year || null,
        }}
        allAlumni={alumni || []}
        networkAlumniIds={Array.from(networkAlumniIds)}
      />
    </>
  )
}