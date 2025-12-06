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

  // Get or create user stats
  let { data: stats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // If no stats exist, create them
  if (!stats) {
    // Count actual connections and messages
    const { count: connectionCount } = await supabase
      .from('user_networks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { count: messageCount } = await supabase
      .from('user_networks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('contacted', true)

    const { data: newStats } = await supabase
      .from('user_stats')
      .insert({
        user_id: user.id,
        total_connections: connectionCount || 0,
        total_messages_sent: messageCount || 0,
      })
      .select()
      .single()
    
    stats = newStats
  }

  // Get all achievements
  const { data: achievements } = await supabase
    .from('achievements')
    .select('*')
    .order('requirement_value', { ascending: true })

  // Get user's unlocked achievements
  const { data: userAchievements } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', user.id)

  const unlockedAchievementIds = userAchievements?.map(ua => ua.achievement_id) || []

  // Get or create today's daily goal
  const today = new Date().toISOString().split('T')[0]
  let { data: dailyGoal } = await supabase
    .from('daily_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  // If no daily goal exists for today, create one
  if (!dailyGoal) {
    const { data: newGoal } = await supabase
      .from('daily_goals')
      .insert({
        user_id: user.id,
        date: today,
        connections_goal: 3,
        messages_goal: 2,
      })
      .select()
      .single()
    
    dailyGoal = newGoal
  }

  // Get network count for navbar
  const { count: networkCount } = await supabase
    .from('user_networks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (
    <>
      <Navbar 
        user={{ email: user.email!, full_name: profile?.full_name }} 
        networkCount={networkCount || 0}
        currentStreak={stats?.current_streak || 0}
      />
      <CareerPathClient 
        userId={user.id}
        stats={stats || {}}
        allAchievements={achievements || []}
        unlockedAchievementIds={unlockedAchievementIds}
        dailyGoal={dailyGoal}
      />
    </>
  )
}