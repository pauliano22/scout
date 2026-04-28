import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ProfileClient from './ProfileClient'
import AlumniProfileClient from './AlumniProfileClient'
import type { Alumni, UserRole } from '@scout/shared/types/database'

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

  const role = (profile?.account_role as UserRole | undefined) ?? 'student'

  // Alumni who haven't finished onboarding land in the claim wizard.
  if (role === 'alumni' && !profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const { data: network } = await supabase
    .from('user_networks')
    .select('id')
    .eq('user_id', user.id)

  if (role === 'alumni') {
    let alumni: Alumni | null = null
    if (profile?.alumni_id) {
      const { data } = await supabase
        .from('alumni')
        .select('*')
        .eq('id', profile.alumni_id)
        .single()
      alumni = (data as Alumni | null) ?? null
    }
    return (
      <>
        <Navbar
          user={{ email: user.email!, full_name: profile?.full_name }}
          networkCount={network?.length || 0}
          role="alumni"
        />
        <AlumniProfileClient
          userEmail={user.email!}
          fullName={profile?.full_name || alumni?.full_name || ''}
          alumni={alumni}
          major={profile?.major ?? null}
        />
      </>
    )
  }

  return (
    <>
      <Navbar
        user={{ email: user.email!, full_name: profile?.full_name }}
        networkCount={network?.length || 0}
        role={role}
      />
      <ProfileClient
        profile={profile}
        userId={user.id}
        userEmail={user.email!}
      />
    </>
  )
}
