import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import CoachClient from './CoachClient'

export default async function CoachPage() {
  const supabase = await createClient()

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

  // Fetch saved coaching plans
  const { data: plans } = await supabase
    .from('coaching_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch network count
  const { count: networkCount } = await supabase
    .from('user_networks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Fetch messages sent count
  const { count: messagesCount } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Fetch recent activity
  const { data: recentNetworkAdds } = await supabase
    .from('user_networks')
    .select(`
      id,
      created_at,
      alumni:alumni_id (
        full_name,
        company
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: recentMessages } = await supabase
    .from('messages')
    .select(`
      id,
      created_at,
      sent_via,
      alumni:alumni_id (
        full_name
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const activity = [
    ...(recentNetworkAdds || []).map((item: any) => ({
      id: item.id,
      type: 'network_add' as const,
      date: item.created_at,
      alumniName: item.alumni?.full_name || 'Unknown',
      company: item.alumni?.company
    })),
    ...(recentMessages || []).map((item: any) => ({
      id: item.id,
      type: 'message_sent' as const,
      date: item.created_at,
      alumniName: item.alumni?.full_name || 'Unknown',
      sentVia: item.sent_via
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)

  // Fetch alumni for recommendations
  const { data: alumni } = await supabase
    .from('alumni')
    .select('id, full_name, company, role, industry, sport, graduation_year, location, linkedin_url')
    .eq('is_public', true)
    .not('company', 'is', null)
    .limit(5000)

  // Fetch user's existing network alumni IDs
  const { data: network } = await supabase
    .from('user_networks')
    .select('alumni_id')
    .eq('user_id', user.id)

  const networkAlumniIds = new Set(network?.map(n => n.alumni_id) || [])

  // Fetch pending suggested actions
  const { data: pendingActions } = await supabase
    .from('suggested_actions')
    .select(`
      *,
      alumni:alumni_id (
        id,
        full_name,
        company,
        role,
        linkedin_url,
        email
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <>
      <Navbar
        user={{ email: user.email!, full_name: profile?.full_name }}
        networkCount={networkCount || 0}
      />
      <CoachClient
        userId={user.id}
        userProfile={{
          name: profile?.full_name || '',
          sport: profile?.sport || '',
          interests: profile?.interests || '',
          graduationYear: profile?.graduation_year || null,
        }}
        allAlumni={alumni || []}
        networkAlumniIds={Array.from(networkAlumniIds)}
        savedPlans={plans || []}
        networkCount={networkCount || 0}
        messagesCount={messagesCount || 0}
        recentActivity={activity}
        initialSuggestedActions={pendingActions || []}
      />
    </>
  )
}
