import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AgentAdminPanel from './AgentAdminPanel'

export default async function AgentPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.is_admin || profile?.account_role === 'admin'

  if (!profile || !isAdmin) {
    return (
      <>
        <Navbar
          user={{ email: user.email!, full_name: profile?.full_name }}
          networkCount={0}
          role={profile?.account_role ?? 'student'}
        />
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-semibold text-[--text-primary]">Not authorized</h1>
          <p className="text-[--text-secondary] mt-3 leading-relaxed">
            This page is restricted to admins. If you believe this is an error, contact another admin to have your role updated.
          </p>
        </div>
      </>
    )
  }

  // ── Fetch agent stats (best-effort; gracefully handle RLS gaps) ──────────
  const stats: {
    activeCampaigns: number | null
    proposedConnections: number | null
    queuedDrafts: number | null
    sentMessages: number | null
    distinctStudents: number | null
  } = {
    activeCampaigns: null,
    proposedConnections: null,
    queuedDrafts: null,
    sentMessages: null,
    distinctStudents: null,
  }

  for (const [key, table, query] of [
    ['activeCampaigns', 'networking_plans', (q: any) => q.eq('is_active', true).eq('campaign_status', 'active')],
    ['proposedConnections', 'user_networks', (q: any) => q.eq('status', 'proposed')],
    ['queuedDrafts', 'outreach_queue', (q: any) => q.eq('status', 'queued_for_approval')],
    ['sentMessages', 'outreach_queue', (q: any) => q.eq('status', 'approved_sent')],
    ['distinctStudents', 'networking_plans', (q: any) => q.eq('is_active', true).eq('campaign_status', 'active')],
  ] as const) {
    try {
      const builder = supabase.from(table as any).select('*', { count: 'exact', head: true })
      const { count } = await (query as any)(builder) as any
      stats[key] = count ?? 0
    } catch {
      stats[key] = null
    }
  }

  // Fully-featured stats via non-head query for distinct student count
  let distinctStudentCount: number | null = null
  try {
    const { data: activePlans } = await supabase
      .from('networking_plans')
      .select('user_id')
      .eq('is_active', true)
      .eq('campaign_status', 'active')
    if (activePlans) {
      distinctStudentCount = new Set(activePlans.map((p: any) => p.user_id)).size
    }
  } catch {
    distinctStudentCount = null
  }

  // ── Environment config (masked secrets) ──────────────────────────────────
  const mask = (val: string | undefined): string =>
    val ? `${val.slice(0, 4)}${'•'.repeat(Math.min(val.length - 4, 16))}` : 'Not set'

  const config = {
    cronSecretSet: !!process.env.CRON_SECRET,
    agentPilotUserIds: process.env.AGENT_PILOT_USER_IDS ?? '',
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
    openaiKeySet: !!process.env.OPENAI_API_KEY,
    supabaseUrlSet: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  }

  return (
    <>
      <Navbar
        user={{ email: user.email!, full_name: profile?.full_name }}
        networkCount={0}
        role="admin"
      />
      <AgentAdminPanel
        stats={stats}
        distinctStudentCount={distinctStudentCount}
        config={config}
        maskedCronSecret={mask(process.env.CRON_SECRET)}
        maskedAnthropicKey={mask(process.env.ANTHROPIC_API_KEY)}
        maskedOpenaiKey={mask(process.env.OPENAI_API_KEY)}
      />
    </>
  )
}
