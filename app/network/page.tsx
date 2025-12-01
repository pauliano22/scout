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

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch user's network with alumni details
  const { data: network, error } = await supabase
    .from('user_networks')
    .select(`
      *,
      alumni:alumni_id (*)
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
