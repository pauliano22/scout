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

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch user stats
  const { data: stats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Fetch all achievements
  const { data: allAchievements } = await supabase
    .from('achievements')
    .select('*')
    .order('requirement_value', { ascending: true })

  // Fetch user's unlocked achievements
  const { data: userAchievements } = await supabase
    .from('user_achievements')
    .select('*, achievement:achievement_id(*)')
    .eq('user_id', user.id)

  // Fetch network count
  const { data: network } = await supabase
    .from('user_networks')
    .select('id')
    .eq('user_id', user.id)

  // Fetch today's goals
  const today = new Date().toISOString().split('T')[0]
  const { data: dailyGoal } = await supabase
    .from('daily_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  return (
    <>
      <Navbar 
        user={{ email: user.email!, full_name: profile?.full_name }} 
        networkCount={network?.length || 0}
      />
      <CareerPathClient 
        userId={user.id}
        stats={stats || {
          current_streak: 0,
          longest_streak: 0,
          total_xp: 0,
          current_level: 1,
          total_connections: network?.length || 0,
          total_messages_sent: 0,
        }}
        allAchievements={allAchievements || []}
        unlockedAchievementIds={userAchievements?.map(ua => ua.achievement_id) || []}
        dailyGoal={dailyGoal}
      />
    </>
  )
}
