import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ProfileClient from './ProfileClient'
import AlumniProfileClient from './AlumniProfileClient'
import { buildCircle, type Circle } from '@/lib/alumni-circle'
import { serviceClient } from '@/lib/requestAuth'
import type { Alumni, AmbassadorProfile, UserRole } from '@scout/shared/types/database'

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

    // Fetch ambassador profile for varsity badge
    let ambassador: AmbassadorProfile | null = null
    const { data: ambData } = await supabase
      .from('ambassador_profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    ambassador = (ambData as AmbassadorProfile | null) ?? null

    // The alum's own circle: teammates from the pre-baked dataset. Warm paths
    // don't apply to viewing your own circle, so saved contacts stay empty.
    // The live overlay (service client — these rows aren't readable under RLS)
    // drops people who opted out or were merged since the bake, and lifts
    // claimed members so "On Scout" teammates actually surface in the top 6.
    let circle: Circle | null = null
    if (profile?.alumni_id) {
      try {
        const svc = serviceClient()
        const [{ data: hiddenRows }, { data: claimedRows }] = await Promise.all([
          svc.from('alumni').select('id').or('is_public.eq.false,is_duplicate.eq.true').limit(5000),
          svc.from('alumni').select('id').eq('is_claimed', true).limit(5000),
        ])
        const hidden = new Set((hiddenRows ?? []).map(r => r.id as string))
        // An opted-out ego gets no section: the circle API and /map both
        // refuse hidden egos, so its links would dead-end.
        if (!hidden.has(profile.alumni_id)) {
          circle = await buildCircle(profile.alumni_id, [], 6, {
            exclude: hidden,
            prioritize: new Set((claimedRows ?? []).map(r => r.id as string)),
          })
        }
      } catch (e) {
        // A missing/corrupt dataset must never take down the profile page.
        console.error('[profile] circle unavailable:', e instanceof Error ? e.message : e)
      }
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
          ambassador={ambassador}
          circle={circle}
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
