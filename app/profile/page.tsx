import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: network } = await supabase
    .from('user_networks')
    .select('id')
    .eq('user_id', user.id)

  return (
    <>
      <Navbar 
        user={{ email: user.email!, full_name: profile?.full_name }} 
        networkCount={network?.length || 0}
      />
      <ProfileClient 
        profile={profile}
        userId={user.id}
      />
    </>
  )
}
