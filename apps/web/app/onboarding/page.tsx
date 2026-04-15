import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingClient from './OnboardingClient'
import AlumniOnboardingClient from './AlumniOnboardingClient'

export default async function OnboardingPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, alumni:alumni_id(sport, graduation_year, company, role, industry, location, linkedin_url)')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_completed) {
    redirect('/plan')
  }

  const linkedAlumni = profile?.alumni as {
    sport?: string
    graduation_year?: number
    company?: string
    role?: string
    industry?: string
    location?: string
    linkedin_url?: string
  } | null

  // Alumni get a streamlined, professional onboarding flow
  if (profile?.alumni_id) {
    return (
      <AlumniOnboardingClient
        userId={user.id}
        userEmail={user.email || ''}
        userName={profile?.full_name || ''}
        prefill={linkedAlumni ? {
          sport: linkedAlumni.sport || '',
          graduationYear: linkedAlumni.graduation_year || null,
          company: linkedAlumni.company || '',
          role: linkedAlumni.role || '',
          industry: linkedAlumni.industry || '',
          location: linkedAlumni.location || '',
          linkedinUrl: linkedAlumni.linkedin_url || '',
        } : undefined}
      />
    )
  }

  // Students get the full multi-step onboarding
  return (
    <OnboardingClient
      userId={user.id}
      userName={profile?.full_name || ''}
      isAlumni={false}
      prefill={undefined}
    />
  )
}
