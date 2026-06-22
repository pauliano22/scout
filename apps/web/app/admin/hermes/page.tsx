'use client'

// Hermes Agent Dashboard — admin command center for Scout's autonomous AI agents.
// Reads from /api/admin/hermes (which shells out to scripts/hermes-bridge.py).

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Shield,
  Wrench,
  Database,
  Palette,
  Rocket,
  RefreshCw,
  Activity,
  Terminal,
  MessageCircle,
  FileText,
  Clock,
  Lightbulb,
  ArrowUpRight,
  AlertTriangle,
  Bot,
  Zap,
  type LucideIcon,
} from 'lucide-react'

// ── Types (mirror scripts/hermes-bridge.py output) ───────────────────────────

interface SessionRow {
  session_id: string | number
  source: string | null
  title: string | null
  started_at: string | null
  ended_at: string | null
  message_count: number | null
  input_tokens: number | null
  output_tokens: number | null
  estimated_cost_usd: number | null
  model: string | null
  last_user_prompt: string | null
}

interface AgentLog {
  name: string
  total_lines?: number
  header?: string[]
  tail?: string[]
  size_bytes?: number
  modified?: string
  error?: string
}

interface SessionDump {
  name: string
  prompt?: string
  modified?: string
  size_bytes?: number
  error?: string
}

interface HermesData {
  sessions: SessionRow[]
  agent_logs: Record<string, AgentLog>
  session_dumps: SessionDump[]
  cron_data: unknown[]
  _error?: string
}

// ── Agent persona definitions ────────────────────────────────────────────────

interface AgentProfile {
  profile: string
  name: string
  role: string
  icon: LucideIcon
  accent: string // tailwind text color for icon tint
  // keywords matched against log filenames (lowercased). Ordered most-specific first
  // across the whole list so 'muse-gtm' resolves to GTM, not Marketing.
  keywords: string[]
}

const AGENTS: AgentProfile[] = [
  { profile: 'scout-gtm', name: 'Muse GTM', role: 'GTM', icon: Rocket, accent: 'text-orange-400', keywords: ['gtm'] },
  { profile: 'scout-marketing', name: 'Muse', role: 'Brand Strategist', icon: Palette, accent: 'text-pink-400', keywords: ['marketing', 'muse'] },
  { profile: 'scout-audit', name: 'Aegis', role: 'Auditor', icon: Shield, accent: 'text-emerald-400', keywords: ['audit', 'aegis'] },
  { profile: 'scout-build', name: 'Forge', role: 'Builder', icon: Wrench, accent: 'text-blue-400', keywords: ['build', 'forge'] },
  { profile: 'scout-data', name: 'Pipeline', role: 'Data Engineer', icon: Database, accent: 'text-violet-400', keywords: ['data', 'pipeline'] },
]

// Display order of cards (matches the spec ordering)
const AGENT_ORDER = ['scout-audit', 'scout-build', 'scout-data', 'scout-marketing', 'scout-gtm']

const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000 // a log modified within 24h ⇒ "active"

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseTime(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

function relativeTime(iso: string | null | undefined): string {
  const t = parseTime(iso)
  if (!t) return '—'
  const diff = Date.now() - t
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(t).toLocaleDateString()
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return ''
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length > n ? clean.slice(0, n) + '…' : clean
}

function formatCost(c: number | null | undefined): string {
  if (c == null) return '—'
  if (c === 0) return '$0.00'
  if (c < 0.01) return '<$0.01'
  return `$${c.toFixed(2)}`
}

function sourceMeta(source: string | null): { icon: LucideIcon; label: string } {
  const s = (source || '').toLowerCase()
  if (s.includes('telegram')) return { icon: MessageCircle, label: 'Telegram' }
  if (s.includes('cli') || s.includes('terminal')) return { icon: Terminal, label: 'CLI' }
  return { icon: Bot, label: source || 'Unknown' }
}

// Assign each log to exactly one agent (first match wins, in AGENTS priority order),
// returning per-agent logs (newest first) plus the orphans matched by nobody.
function assignLogs(logs: Record<string, AgentLog>) {
  const byAgent = new Map<string, AgentLog[]>()
  AGENTS.forEach((a) => byAgent.set(a.profile, []))
  const orphans: AgentLog[] = []

  const entries = Object.values(logs || {})
  for (const log of entries) {
    const lname = (log.name || '').toLowerCase()
    const owner = AGENTS.find((a) => a.keywords.some((k) => lname.includes(k)))
    if (owner) byAgent.get(owner.profile)!.push(log)
    else orphans.push(log)
  }

  // newest-first within each bucket
  for (const arr of byAgent.values()) arr.sort((a, b) => parseTime(b.modified) - parseTime(a.modified))
  orphans.sort((a, b) => parseTime(b.modified) - parseTime(a.modified))

  return { byAgent, orphans }
}

// ── Small UI primitives ──────────────────────────────────────────────────────

function StatusDot({ state }: { state: 'active' | 'stale' | 'none' }) {
  const cls =
    state === 'active'
      ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
      : state === 'stale'
        ? 'bg-red-500'
        : 'bg-[--text-quaternary]'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />
}

function SectionHeader({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className="text-[--text-quaternary]" />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[--text-quaternary]">{children}</h2>
    </div>
  )
}

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-[--bg-secondary] border border-[--border-primary] rounded-xl ${className}`}>{children}</div>
)

// ── Skeletons ────────────────────────────────────────────────────────────────

function AgentCardSkeleton() {
  return (
    <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="skeleton w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-5/6 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="skeleton w-6 h-6 rounded-full" />
      <div className="skeleton h-3 flex-1 rounded" />
      <div className="skeleton h-3 w-12 rounded" />
    </div>
  )
}

// ── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, log }: { agent: AgentProfile; log: AgentLog | undefined }) {
  const Icon = agent.icon
  const modified = log?.modified
  const state: 'active' | 'stale' | 'none' = !log
    ? 'none'
    : Date.now() - parseTime(modified) < ACTIVE_WINDOW_MS
      ? 'active'
      : 'stale'

  // First 3 lines from header + last 3 from tail.
  const head = (log?.header ?? []).filter((l) => l.trim()).slice(0, 3)
  const tail = (log?.tail ?? []).filter((l) => l.trim()).slice(-3)

  return (
    <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 hover:border-[--border-hover] transition-colors">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 p-2.5 rounded-lg bg-[--bg-tertiary] ${agent.accent}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[--text-primary] truncate">{agent.name}</h3>
            <StatusDot state={state} />
          </div>
          <p className="text-xs text-[--text-tertiary] mt-0.5">{agent.role}</p>
        </div>
        <span className="shrink-0 text-[10px] text-[--text-quaternary] tabular-nums">{relativeTime(modified)}</span>
      </div>

      <div className="mt-4">
        {!log ? (
          <p className="text-xs text-[--text-tertiary] italic">No recent activity</p>
        ) : log.error ? (
          <p className="text-xs text-red-400">Log error: {log.error}</p>
        ) : (
          <div className="rounded-lg bg-[--bg-primary] border border-[--border-primary] p-3 font-mono text-[11px] leading-relaxed text-[--text-secondary] overflow-hidden">
            {head.map((l, i) => (
              <p key={`h${i}`} className="truncate">
                {l}
              </p>
            ))}
            {tail.length > 0 && head.length > 0 && (
              <p className="text-[--text-quaternary] select-none">· · ·</p>
            )}
            {tail.map((l, i) => (
              <p key={`t${i}`} className="truncate">
                {l}
              </p>
            ))}
          </div>
        )}
        {log && (
          <div className="flex items-center gap-3 mt-2.5 text-[10px] text-[--text-quaternary]">
            <span className="truncate font-mono">{log.name}</span>
            {typeof log.total_lines === 'number' && <span className="shrink-0">{log.total_lines} lines</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Activity feed ────────────────────────────────────────────────────────────

interface FeedItem {
  id: string
  ts: number
  icon: LucideIcon
  accent: string
  text: string
  sub?: string
}

function buildFeed(data: HermesData): FeedItem[] {
  const items: FeedItem[] = []

  for (const log of Object.values(data.agent_logs || {})) {
    const owner = AGENTS.find((a) => a.keywords.some((k) => (log.name || '').toLowerCase().includes(k)))
    items.push({
      id: `log-${log.name}`,
      ts: parseTime(log.modified),
      icon: owner?.icon ?? FileText,
      accent: owner?.accent ?? 'text-[--text-tertiary]',
      text: owner ? `${owner.name} updated log` : `Log updated`,
      sub: log.name,
    })
  }

  for (const s of data.sessions || []) {
    const { icon } = sourceMeta(s.source)
    items.push({
      id: `sess-${s.session_id}`,
      ts: parseTime(s.started_at),
      icon,
      accent: 'text-[--text-secondary]',
      text: s.title || 'Session',
      sub: truncate(s.last_user_prompt, 70),
    })
  }

  return items.filter((i) => i.ts > 0).sort((a, b) => b.ts - a.ts).slice(0, 15)
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function HermesDashboardPage() {
  const [data, setData] = useState<HermesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (isManual: boolean) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await fetch('/api/admin/hermes', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      const payload: HermesData = json.data ?? json
      setData({
        sessions: payload.sessions ?? [],
        agent_logs: payload.agent_logs ?? {},
        session_dumps: payload.session_dumps ?? [],
        cron_data: payload.cron_data ?? [],
        _error: payload._error,
      })
      setError(null)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(false)
  }, [load])

  // auto-refresh every 15s
  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(() => load(true), 15_000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [autoRefresh, load])

  const { byAgent, orphans } = data ? assignLogs(data.agent_logs) : { byAgent: new Map<string, AgentLog[]>(), orphans: [] as AgentLog[] }
  const feed = data ? buildFeed(data) : []
  const sessions = data?.sessions ?? []

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[--school-primary]/10 text-[--school-primary]">
              <Zap size={20} />
            </div>
            <h1 className="text-2xl font-bold text-[--text-primary]">Hermes Agents</h1>
          </div>
          <p className="text-sm text-[--text-secondary] mt-1.5">
            Command center for Scout&rsquo;s autonomous AI agent network
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[--text-tertiary] tabular-nums">
            {lastUpdated ? `Updated ${relativeTime(lastUpdated.toISOString())}` : 'Loading…'}
          </span>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              autoRefresh
                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                : 'border-[--border-primary] bg-[--bg-secondary] text-[--text-secondary] hover:border-[--border-hover]'
            }`}
            title="Auto-refresh every 15s"
          >
            <RefreshCw size={14} className={autoRefresh || refreshing ? 'animate-spin' : ''} />
            Auto-refresh {autoRefresh ? 'on' : 'off'}
          </button>
        </div>
      </div>

      {/* ── Bridge error banner (data still renders) ────────────────────── */}
      {data?._error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Bridge warning: {data._error}</span>
        </div>
      )}

      {/* ── Fatal error state ───────────────────────────────────────────── */}
      {error && !data && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Failed to load: {error}</p>
            <button onClick={() => load(true)} className="mt-2 underline hover:no-underline">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Body grid: agents (left) + activity (right) ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent status cards */}
        <section className="lg:col-span-2">
          <SectionHeader icon={Bot}>Agent Status</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <AgentCardSkeleton key={i} />)
              : AGENT_ORDER.map((profile) => {
                  const agent = AGENTS.find((a) => a.profile === profile)!
                  const log = byAgent.get(profile)?.[0]
                  return <AgentCard key={profile} agent={agent} log={log} />
                })}

            {/* Orphan logs (matched no agent) */}
            {!loading && orphans.length > 0 && (
              <div className="sm:col-span-2 bg-[--bg-secondary] border border-dashed border-[--border-primary] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} className="text-[--text-quaternary]" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[--text-quaternary]">
                    Unassigned Logs ({orphans.length})
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {orphans.map((o) => (
                    <span
                      key={o.name}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[--bg-tertiary] px-2 py-1 text-[11px] font-mono text-[--text-tertiary]"
                      title={`Modified ${relativeTime(o.modified)}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[--text-quaternary]" />
                      {o.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Activity feed */}
        <section className="lg:col-span-1">
          <SectionHeader icon={Activity}>Activity Feed</SectionHeader>
          <Card className="overflow-hidden">
            {loading ? (
              <div className="divide-y divide-[--border-primary]">
                {Array.from({ length: 8 }).map((_, i) => (
                  <RowSkeleton key={i} />
                ))}
              </div>
            ) : feed.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[--text-tertiary]">No data yet</p>
            ) : (
              <div className="divide-y divide-[--border-primary] max-h-[640px] overflow-y-auto">
                {feed.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                      <div className={`shrink-0 mt-0.5 ${item.accent}`}>
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[--text-primary] truncate">{item.text}</p>
                        {item.sub && <p className="text-[11px] text-[--text-tertiary] truncate mt-0.5">{item.sub}</p>}
                      </div>
                      <span className="shrink-0 text-[10px] text-[--text-quaternary] tabular-nums">
                        {relativeTime(new Date(item.ts).toISOString())}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </section>
      </div>

      {/* ── Recent prompts / commands ───────────────────────────────────── */}
      <section>
        <SectionHeader icon={Terminal}>Recent Prompts &amp; Commands</SectionHeader>
        <Card className="overflow-hidden">
          {loading ? (
            <div className="divide-y divide-[--border-primary]">
              {Array.from({ length: 5 }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[--text-tertiary]">No prompts yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--border-primary] text-left text-[11px] uppercase tracking-wider text-[--text-quaternary]">
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Session</th>
                    <th className="px-4 py-3 font-medium">Last Prompt</th>
                    <th className="px-4 py-3 font-medium text-right">Msgs</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium text-right">Cost</th>
                    <th className="px-4 py-3 font-medium text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--border-primary]">
                  {sessions.map((s) => {
                    const { icon: SrcIcon, label } = sourceMeta(s.source)
                    return (
                      <tr key={String(s.session_id)} className="hover:bg-[--bg-hover] transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[--text-secondary]">
                            <SrcIcon size={14} className="text-[--text-tertiary]" />
                            {label}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          <span className="block truncate text-[--text-primary]">{s.title || 'Untitled'}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[280px]">
                          <span className="block truncate text-[--text-secondary]" title={s.last_user_prompt || ''}>
                            {truncate(s.last_user_prompt, 80) || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[--text-secondary]">
                          {s.message_count ?? '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs font-mono text-[--text-tertiary]">{s.model || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[--text-secondary]">
                          {formatCost(s.estimated_cost_usd)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-xs text-[--text-quaternary] tabular-nums">
                          {relativeTime(s.started_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* ── New ideas ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={Lightbulb}>New Ideas</SectionHeader>
        <Link
          href="/admin/ideas"
          className="group flex items-center justify-between gap-4 rounded-xl border border-[--border-primary] bg-[--bg-secondary] p-5 hover:border-[--border-hover] transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Lightbulb size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-[--text-primary]">Idea Board</p>
              <p className="text-xs text-[--text-tertiary] mt-1 leading-relaxed">
                New ideas from the orchestrator are tracked on the Scout Idea Board. Visit{' '}
                <code className="rounded bg-[--bg-tertiary] px-1 text-[--text-secondary]">/admin/ideas</code> to view and vote.
              </p>
            </div>
          </div>
          <ArrowUpRight size={18} className="shrink-0 text-[--text-quaternary] group-hover:text-[--text-secondary] transition-colors" />
        </Link>
      </section>

      <div className="flex items-center gap-1.5 pt-2 text-[11px] text-[--text-quaternary]">
        <Clock size={11} />
        <span>
          Data sourced from <code className="rounded bg-[--bg-tertiary] px-1">~/.hermes</code> via the bridge. Nothing is sent or
          actioned from this view.
        </span>
      </div>
    </div>
  )
}
