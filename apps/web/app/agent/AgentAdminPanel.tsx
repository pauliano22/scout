'use client'

// Agent Admin Panel — management/diagnostic UI for Scout's autonomous agent loop.
// Server-fetched data is passed as props; interactive parts live here.

import { useState } from 'react'
import { Play, RefreshCw, AlertCircle, CheckCircle, XCircle, Activity, Users, FileText, Send, UserCheck } from 'lucide-react'

interface Stats {
  activeCampaigns: number | null
  proposedConnections: number | null
  queuedDrafts: number | null
  sentMessages: number | null
  distinctStudents: number | null
}

interface Config {
  cronSecretSet: boolean
  agentPilotUserIds: string
  anthropicKeySet: boolean
  openaiKeySet: boolean
  supabaseUrlSet: boolean
}

interface Props {
  stats: Stats
  distinctStudentCount: number | null
  config: Config
  maskedCronSecret: string
  maskedAnthropicKey: string
  maskedOpenaiKey: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const StatCard = ({
  icon,
  label,
  value,
  loading,
  colorClass = 'text-[--text-primary]',
}: {
  icon: React.ReactNode
  label: string
  value: number | string | null
  loading?: boolean
  colorClass?: string
}) => (
  <div className="stat-card flex items-start gap-4">
    <div className="shrink-0 mt-0.5 text-[--text-quaternary]">{icon}</div>
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-[--text-quaternary]">{label}</p>
      {loading ? (
        <div className="skeleton h-7 w-16 rounded mt-1" />
      ) : value === null ? (
        <p className="text-sm text-[--text-tertiary] mt-1">N/A (RLS)</p>
      ) : (
        <p className={`text-2xl font-semibold mt-0.5 tabular-nums ${colorClass}`}>{value}</p>
      )}
    </div>
  </div>
)

const StatusDot = ({ ok }: { ok: boolean }) => (
  <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
)

const Divider = () => <div className="divider my-6" />

// ── Main Component ──────────────────────────────────────────────────────────

export default function AgentAdminPanel({
  stats,
  distinctStudentCount,
  config,
  maskedCronSecret,
  maskedAnthropicKey,
  maskedOpenaiKey,
}: Props) {
  const [tickStatus, setTickStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [tickResult, setTickResult] = useState<string | null>(null)

  async function handleManualTick() {
    setTickStatus('running')
    setTickResult(null)
    try {
      const res = await fetch('/api/agent/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await res.json()
      if (res.ok) {
        setTickStatus('success')
        const summary = Array.isArray(body.summary) ? body.summary : []
        const parts = summary.map((s: any) => {
          const errorMsg = s.error ? ` (error: ${s.error})` : ''
          return `  • ${s.userId}: sourced ${s.sourced}, drafted ${s.introDrafts} intro${s.introDrafts === 1 ? '' : 's'} + ${s.followupDrafts} follow-up${s.followupDrafts === 1 ? '' : 's'}${errorMsg}`
        })
        setTickResult([
          `Ticked ${body.ticked} campaign(s)`,
          ...parts,
        ].join('\n'))
      } else {
        setTickStatus('error')
        setTickResult(body.error ?? body.note ?? `HTTP ${res.status}`)
      }
    } catch (e) {
      setTickStatus('error')
      setTickResult(e instanceof Error ? e.message : 'Network error')
    }
  }

  const showStats = stats.activeCampaigns !== null

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[--text-primary]">
          Agent Management
        </h1>
        <p className="text-[--text-secondary] mt-1.5 text-sm">
          Monitor and manage Scout&rsquo;s autonomous agent loop. All actions are logged.
        </p>
      </div>

      {/* ── Campaign Stats ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-[--text-quaternary]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[--text-quaternary]">
            Campaign Stats
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            icon={<Users size={18} />}
            label="Active Campaigns"
            value={stats.activeCampaigns}
            loading={!showStats}
          />
          <StatCard
            icon={<UserCheck size={18} />}
            label="Distinct Students"
            value={distinctStudentCount}
            loading={!showStats}
          />
          <StatCard
            icon={<Users size={18} />}
            label="Proposed Connections"
            value={stats.proposedConnections}
            loading={!showStats}
          />
          <StatCard
            icon={<FileText size={18} />}
            label="Queued Drafts"
            value={stats.queuedDrafts}
            loading={!showStats}
          />
          <StatCard
            icon={<Send size={18} />}
            label="Sent Messages"
            value={stats.sentMessages}
            loading={!showStats}
          />
        </div>
        {!showStats && (
          <p className="text-xs text-[--text-tertiary] mt-3">
            Stats unavailable — the admin role may be missing table-read permissions (RLS). Contact a database admin to grant <code className="text-[--text-secondary] bg-[--bg-tertiary] px-1 rounded">SELECT</code> on agent tables for authenticated admins.
          </p>
        )}
      </section>

      <Divider />

      {/* ── Manual Tick Trigger ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Play size={16} className="text-[--text-quaternary]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[--text-quaternary]">
            Manual Tick
          </h2>
        </div>
        <div className="card p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[--text-primary] font-medium">
                Trigger the agent loop now
              </p>
              <p className="text-xs text-[--text-tertiary] mt-1 leading-relaxed">
                Posts to <code className="text-[--text-secondary] bg-[--bg-tertiary] px-1 rounded">/api/agent/tick</code>. Requires a valid <code className="text-[--text-secondary] bg-[--bg-tertiary] px-1 rounded">CRON_SECRET</code> environment variable to be set — without it the endpoint will return 401. The loop only processes users listed in <code className="text-[--text-secondary] bg-[--bg-tertiary] px-1 rounded">AGENT_PILOT_USER_IDS</code>.
              </p>
            </div>
            <button
              onClick={handleManualTick}
              disabled={tickStatus === 'running'}
              className="btn-primary shrink-0 gap-2"
            >
              {tickStatus === 'running' ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Trigger Tick
                </>
              )}
            </button>
          </div>

          {tickResult && (
            <div
              className={`mt-4 p-3 rounded-xl text-sm font-mono whitespace-pre-line leading-relaxed ${
                tickStatus === 'success'
                  ? 'bg-green-500/8 border border-green-500/15 text-green-400'
                  : tickStatus === 'error'
                    ? 'bg-red-500/8 border border-red-500/15 text-red-400'
                    : ''
              }`}
            >
              {tickResult}
            </div>
          )}
        </div>
      </section>

      <Divider />

      {/* ── Config Status ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-[--text-quaternary]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[--text-quaternary]">
            Environment Config
          </h2>
        </div>
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-[--border-primary] last:border-b-0">
            <div>
              <span className="text-sm text-[--text-primary] font-medium">CRON_SECRET</span>
              <p className="text-xs text-[--text-tertiary] mt-0.5">{maskedCronSecret}</p>
            </div>
            <StatusDot ok={config.cronSecretSet} />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[--border-primary] last:border-b-0">
            <div>
              <span className="text-sm text-[--text-primary] font-medium">AGENT_PILOT_USER_IDS</span>
              <p className="text-xs text-[--text-tertiary] mt-0.5">
                {config.agentPilotUserIds
                  ? `${config.agentPilotUserIds.split(',').length} user(s) configured`
                  : 'Not set — loop is inert'}
              </p>
            </div>
            <StatusDot ok={config.agentPilotUserIds.length > 0} />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[--border-primary] last:border-b-0">
            <div>
              <span className="text-sm text-[--text-primary] font-medium">ANTHROPIC_API_KEY</span>
              <p className="text-xs text-[--text-tertiary] mt-0.5">{maskedAnthropicKey}</p>
            </div>
            <StatusDot ok={config.anthropicKeySet} />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[--border-primary] last:border-b-0">
            <div>
              <span className="text-sm text-[--text-primary] font-medium">OPENAI_API_KEY</span>
              <p className="text-xs text-[--text-tertiary] mt-0.5">{maskedOpenaiKey}</p>
            </div>
            <StatusDot ok={config.openaiKeySet} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-sm text-[--text-primary] font-medium">NEXT_PUBLIC_SUPABASE_URL</span>
              <p className="text-xs text-[--text-tertiary] mt-0.5">
                {config.supabaseUrlSet ? 'Configured' : 'Not set'}
              </p>
            </div>
            <StatusDot ok={config.supabaseUrlSet} />
          </div>
        </div>
      </section>

      <Divider />

      {/* ── Info ─────────────────────────────────────────────────────────── */}
      <section className="text-xs text-[--text-quaternary] leading-relaxed space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[--text-tertiary] mb-2">Notes</h3>
        <p>
          The agent loop runs via Vercel Cron (typically every 3&ndash;6 hours). It sources alumni candidates and drafts intros &mdash; nothing is sent or contacted without human approval.
        </p>
        <p>
          Stats counts depend on Supabase RLS policies granting <code className="text-[--text-secondary] bg-[--bg-tertiary] px-1 rounded">SELECT</code> access to admin users on the agent tables (<code className="text-[--text-secondary] bg-[--bg-tertiary] px-1 rounded">networking_plans</code>, <code className="text-[--text-secondary] bg-[--bg-tertiary] px-1 rounded">user_networks</code>, <code className="text-[--text-secondary] bg-[--bg-tertiary] px-1 rounded">outreach_queue</code>).
        </p>
        <p>
          To widen the pilot, add user IDs (comma-separated) to the <code className="text-[--text-secondary] bg-[--bg-tertiary] px-1 rounded">AGENT_PILOT_USER_IDS</code> environment variable.
        </p>
      </section>

    </div>
  )
}
