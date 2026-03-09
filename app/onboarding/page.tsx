import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingClient from './OnboardingClient'

export default async function OnboardingPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, alumni:alumni_id(sport, graduation_year, company, role, industry, location)')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_completed) {
    redirect('/plan')
  }

  // If the profile is linked to an alumni row, pass pre-fill data
  const linkedAlumni = profile?.alumni as {
    sport?: string
    graduation_year?: number
    company?: string
    role?: string
    industry?: string
    location?: string
  } | null

  return (
    <OnboardingClient
      userId={user.id}
      userName={profile?.full_name || ''}
      isAlumni={!!profile?.alumni_id}
      prefill={linkedAlumni ? {
        sport: linkedAlumni.sport || '',
        graduationYear: linkedAlumni.graduation_year || null,
        primaryIndustry: linkedAlumni.industry || '',
      } : undefined}
    />
  )
}
