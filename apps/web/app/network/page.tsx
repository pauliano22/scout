import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import NetworkClient from './NetworkClient'
import { UserNetwork } from '@scout/shared/types/database'
import { sanitizeAlumniForStudent } from '@/lib/privacy/sanitizeAlumni'

export default async function NetworkPage() {
  const supabase = createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch user profile - only needed fields
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, sport, interests')
    .eq('id', user.id)
    .single()

  // Fetch user's network with alumni details. Explicit alumni columns: `*`
  // would drag the pgvector embedding (1536 floats per row) into every page
  // load. Keep this list in sync with the alumni table (see ALUMNI_COLS in
  // lib/agent/dailyPicks.ts).
  const { data: network, error } = await supabase
    .from('user_networks')
    .select(`
      *,
      alumni:alumni_id (id, full_name, email, linkedin_url, sport, graduation_year, company, role, industry, location, avatar_url, photo_url, is_verified, is_public, source, school_id, created_at, updated_at, work_history, skills, education, display_headline, path_summary_stub, current_status_type, bio, advice, share_email_with_students, is_claimed, claimed_at, claim_source, claimed_by_user_id, profile_reviewed_by_alumni, engagement_intent, prestige_score)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching network:', error)
  }

  // Drop rows whose alum RLS hid from this user (e.g. opted out via /remove):
  // they would render as empty "?" cards with no name or actions.
  // Consent gate at egress: this page renders for a student session.
  const visibleNetwork = (network || [])
    .filter((n) => !n.alumni_id || n.alumni)
    .map((n) => (n.alumni ? { ...n, alumni: sanitizeAlumniForStudent(n.alumni) } : n))

  // Fetch all custom contacts for this user (plan_id may be null for standalone contacts)
  const { data: customContacts } = await supabase
    .from('plan_custom_contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return (
    <>
      <Navbar
        user={{ email: user.email!, full_name: profile?.full_name }}
        networkCount={visibleNetwork.length}
      />
      <NetworkClient
        initialNetwork={visibleNetwork as UserNetwork[]}
        userId={user.id}
        userProfile={{
          name: profile?.full_name || '',
          sport: profile?.sport || '',
        }}
        initialCustomContacts={customContacts || []}
      />
    </>
  )
}
