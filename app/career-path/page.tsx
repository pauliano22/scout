import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import CareerPathClient from './CareerPathClient'

export default async function CareerPathPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Count connections
  const { count: connectionCount } = await supabase
    .from('user_networks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Count messages sent
  const { count: messageCount } = await supabase
    .from('user_networks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('contacted', true)

  // Get or create user stats (for streak tracking)
  let { data: stats } = await supabase
    .from('user_stats')
    .select('current_streak, longest_streak')
    .eq('user_id', user.id)
    .single()

  // If no stats exist, create them
  if (!stats) {
    const { data: newStats } = await supabase
      .from('user_stats')
      .insert({
        user_id: user.id,
        total_connections: connectionCount || 0,
        total_messages_sent: messageCount || 0,
        current_streak: 0,
        longest_streak: 0,
      })
      .select('current_streak, longest_streak')
      .single()
    stats = newStats
  }

  return (
    <>
      <Navbar
        user={{ email: user.email!, full_name: profile?.full_name }}
        networkCount={connectionCount || 0}
        currentStreak={stats?.current_streak || 0}
      />
      <CareerPathClient
        userId={user.id}
        stats={{
          current_streak: stats?.current_streak || 0,
          longest_streak: stats?.longest_streak || 0,
          total_connections: connectionCount || 0,
          total_messages_sent: messageCount || 0,
        }}
      />
    </>
  )
}