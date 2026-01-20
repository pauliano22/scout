import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import NetworkClient from './NetworkClient'

export default async function NetworkPage() {
  const supabase = createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch user profile - only needed fields
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, sport, interests')
    .eq('id', user.id)
    .single()

  // Fetch user's network with alumni details - only needed fields for performance
  const { data: network, error } = await supabase
    .from('user_networks')
    .select(`
      id, user_id, alumni_id, contacted, contacted_at, notes, status, interactions, created_at,
      alumni:alumni_id (id, full_name, company, role, industry, sport, graduation_year, linkedin_url, location)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching network:', error)
  }

  return (
    <>
      <Navbar 
        user={{ email: user.email!, full_name: profile?.full_name }} 
        networkCount={network?.length || 0}
      />
      <NetworkClient 
        initialNetwork={network || []}
        userId={user.id}
        userProfile={{
          name: profile?.full_name || '',
          sport: profile?.sport || '',
          interests: profile?.interests || '',
        }}
      />
    </>
  )
}
