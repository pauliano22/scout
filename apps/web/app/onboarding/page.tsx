import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { postLoginPath } from '@/lib/auth/postLoginPath'
import type { UserRole } from '@scout/shared/types/database'
import OnboardingClient from './OnboardingClient'
import AlumniOnboardingClient from './AlumniOnboardingClient'
import DesktopNudge from '@/components/DesktopNudge'

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

  const role = (profile?.account_role as UserRole | undefined) ?? 'student'

  if (profile?.onboarding_completed) {
    redirect(postLoginPath(role, true))
  }

  // Alumni: claim wizard. The wizard runs the match itself, but if this user
  // arrived via the legacy email-link path (mig 012), prefill from the linked row.
  if (role === 'alumni') {
    const linkedAlumni = profile?.alumni as {
      sport?: string
      graduation_year?: number
      company?: string
      role?: string
      industry?: string
      location?: string
      linkedin_url?: string
    } | null

    return (
      <>
        <DesktopNudge />
        <AlumniOnboardingClient
          userId={user.id}
          userEmail={user.email || ''}
          userName={profile?.full_name || ''}
          prefillAlumniId={profile?.alumni_id || null}
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
      </>
    )
  }

  // Students: full multi-step onboarding.
  return (
    <>
      <DesktopNudge />
      <OnboardingClient
        userId={user.id}
        userName={profile?.full_name || ''}
        isAlumni={false}
        prefill={undefined}
      />
    </>
  )
}
