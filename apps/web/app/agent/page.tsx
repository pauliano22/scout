import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgentClient from './AgentClient'

export const metadata = {
  title: 'Scout Agent | Cornell',
  description: 'Your autonomous networking assistant',
}

export default async function AgentPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Gate behind auth — unauthenticated users go to login
  if (!user) redirect('/login')

  // Fetch the user's sport so the agent can personalize for them
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, sport')
    .eq('id', user.id)
    .single()

  return <AgentClient userSport={profile?.sport ?? null} userName={profile?.full_name ?? null} />
}
