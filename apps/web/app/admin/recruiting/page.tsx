'use client'

// Admin Recruiting CRM — the worklist over every current student-athlete who
// could be on Scout. Live universe + lazy CRM overlay; derived stages
// (signed_up/activated) are computed server-side and never hand-set.

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Pin,
  Search,
  Send,
  Star,
} from 'lucide-react'
import Avatar from '@/components/Avatar'
import type { EffectiveStage, ProspectRow, TeamRollup } from '@/lib/recruiting/merge'
import { ACTIVITY_KIND_LABELS, STAGES, STAGE_ORDER, relativeDate } from './stageConfig'
import RecruitingDrawer from './RecruitingDrawer'
import TeamsGrid from './TeamsGrid'

interface WorklistResponse {
  prospects: ProspectRow[]
  total: number
  page: number
  limit: number
  totalPages: number
  crmReady: boolean
}

interface SummaryResponse {
  crmReady: boolean
  stages: Record<EffectiveStage, number>
  stalled_count: number
  due_today_count: number
  teams: TeamRollup[]
}

interface StatCard {
  key: string
  label: string
  value: number
  sub?: string
  red?: boolean
  active: boolean
  onClick: () => void
}

const TAB_STAGES: EffectiveStage[] = [...STAGE_ORDER, 'not_now']

// Mirrors the server-side universe cutoff: current classes only.
const GRAD_YEARS = (() => {
  const now = new Date()
  const cutoff = now.getFullYear() + (now.getMonth() >= 5 ? 1 : 0)
  return [cutoff, cutoff + 1, cutoff + 2]
})()

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong'
}

function isOverdue(r: ProspectRow): boolean {
  const due = r.crm?.next_action_due
  if (!due) return false
  const s = r.effective_stage
  if (s === 'signed_up' || s === 'activated' || s === 'not_now') return false
  return due <= new Date().toISOString().slice(0, 10)
}

function formatDue(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function pillClass(active: boolean): string {
  return `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
    active ? 'bg-[--bg-active] text-[--text-primary]' : 'text-[--text-secondary] hover:bg-[--bg-hover]'
  }`
}

export default function AdminRecruitingPage() {
  const [view, setView] = useState<'pipeline' | 'teams'>('pipeline')
  const [data, setData] = useState<WorklistResponse | null>(null)
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [focusRows, setFocusRows] = useState<ProspectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [team, setTeam] = useState('')
  const [year, setYear] = useState('')
  const [stage, setStage] = useState<EffectiveStage | 'all'>('all')
  const [sort, setSort] = useState('priority')
  const [focusOnly, setFocusOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [actingTeam, setActingTeam] = useState<string | null>(null)
  const [actingFocus, setActingFocus] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<{ alumniId: string; composerKind: string | null } | null>(null)

  // Team strategy card (dirty-tracked notes)
  const [strategyOpen, setStrategyOpen] = useState(true)
  const [strategyNotes, setStrategyNotes] = useState('')
  const [savedStrategyNotes, setSavedStrategyNotes] = useState('')
  const [notesTeam, setNotesTeam] = useState('')
  const [savingStrategy, setSavingStrategy] = useState(false)

  const didInit = useRef(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchList = useCallback(async () => {
    setError('')
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (team) params.set('team', team)
      if (year) params.set('year', year)
      if (stage !== 'all') params.set('stage', stage)
      if (focusOnly) params.set('focus', '1')
      params.set('sort', sort)
      params.set('page', String(page))

      const res = await fetch(`/api/admin/recruiting?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load prospects')
      setData(json.data)
    } catch (e) {
      setError(errMessage(e))
    }
  }, [debouncedSearch, team, year, stage, sort, focusOnly, page])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/recruiting/summary')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load summary')
      setSummary(json.data)
    } catch (e) {
      setError(errMessage(e))
    }
  }, [])

  const fetchFocus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/recruiting?focus=1&sort=priority&limit=10')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load focus list')
      setFocusRows(json.data.prospects)
    } catch (e) {
      setError(errMessage(e))
    }
  }, [])

  // Initial load fetches everything in parallel; subsequent filter/page
  // changes silently refetch the list only.
  useEffect(() => {
    if (didInit.current) {
      fetchList()
      return
    }
    didInit.current = true
    Promise.all([fetchList(), fetchSummary(), fetchFocus()]).finally(() => setLoading(false))
  }, [fetchList, fetchSummary, fetchFocus])

  const refetchAll = useCallback(() => {
    fetchList()
    fetchSummary()
    fetchFocus()
  }, [fetchList, fetchSummary, fetchFocus])

  // Sync strategy notes when the team filter changes (never clobbers
  // in-progress edits on summary refetches).
  useEffect(() => {
    if (team && team !== notesTeam && summary) {
      const notes = summary.teams.find((t) => t.team_key === team)?.strategy_notes ?? ''
      setStrategyNotes(notes)
      setSavedStrategyNotes(notes)
      setNotesTeam(team)
    }
    if (!team && notesTeam) setNotesTeam('')
  }, [team, notesTeam, summary])

  const crmReady = data?.crmReady ?? summary?.crmReady ?? false
  const rosterTotal = summary ? Object.values(summary.stages).reduce((a, b) => a + b, 0) : 0
  const signedPct = summary && rosterTotal ? Math.round((summary.stages.signed_up / rosterTotal) * 100) : 0
  const activeTeamRollup = team ? summary?.teams.find((t) => t.team_key === team) ?? null : null

  const applyStageFilter = (s: EffectiveStage | 'all') => {
    setView('pipeline')
    setStage(s)
    setFocusOnly(false)
    setPage(1)
  }

  const applyStalledFilter = () => {
    setView('pipeline')
    setStage('all')
    setFocusOnly(true)
    setPage(1)
  }

  const handleOpenTeam = (teamKey: string) => {
    setTeam(teamKey)
    setStage('untouched')
    setFocusOnly(false)
    setPage(1)
    setView('pipeline')
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (team) params.set('team', team)
    if (year) params.set('year', year)
    if (stage !== 'all') params.set('stage', stage)
    if (focusOnly) params.set('focus', '1')
    window.open(`/api/admin/recruiting/export?${params}`)
  }

  const handleFocusDone = async (alumniId: string) => {
    setActingFocus(alumniId)
    try {
      const res = await fetch(`/api/admin/recruiting/${alumniId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_action: null, next_action_due: null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to clear next action')
      refetchAll()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setActingFocus(null)
    }
  }

  const handleTogglePin = async (t: TeamRollup) => {
    setActingTeam(t.team_key)
    try {
      const res = await fetch('/api/admin/recruiting/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_key: t.team_key, is_focus: !t.is_focus }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update team')
      await fetchSummary()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setActingTeam(null)
    }
  }

  const handleSaveStrategy = async () => {
    setSavingStrategy(true)
    try {
      const res = await fetch('/api/admin/recruiting/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_key: team, strategy_notes: strategyNotes }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save notes')
      setSavedStrategyNotes(strategyNotes)
      fetchSummary()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setSavingStrategy(false)
    }
  }

  const handleCopyHandle = (e: MouseEvent, r: ProspectRow) => {
    e.stopPropagation()
    const handle = r.crm?.instagram_handle?.replace(/^@/, '')
    if (!handle) return
    navigator.clipboard.writeText(handle).catch(() => {})
    setCopiedId(r.alumni_id)
    setTimeout(() => setCopiedId((c) => (c === r.alumni_id ? null : c)), 1500)
  }

  const statCards: StatCard[] = summary
    ? [
        { key: 'roster', label: 'Roster', value: rosterTotal, active: stage === 'all' && !focusOnly, onClick: () => applyStageFilter('all') },
        { key: 'reached', label: 'Reached', value: summary.stages.reached_out, active: stage === 'reached_out', onClick: () => applyStageFilter('reached_out') },
        { key: 'responded', label: 'Responded', value: summary.stages.responded, active: stage === 'responded', onClick: () => applyStageFilter('responded') },
        { key: 'signed_up', label: 'Signed up', value: summary.stages.signed_up, sub: `${signedPct}% of roster`, active: stage === 'signed_up', onClick: () => applyStageFilter('signed_up') },
        { key: 'activated', label: 'Activated', value: summary.stages.activated, active: stage === 'activated', onClick: () => applyStageFilter('activated') },
        { key: 'stalled', label: 'Stalled', value: summary.stalled_count, red: true, active: focusOnly, onClick: applyStalledFilter },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[--text-primary]">Recruiting</h1>
          <p className="text-sm text-[--text-secondary] mt-1">Every current student-athlete who could be on Scout</p>
        </div>
        <button onClick={handleExport} className="btn-secondary">
          Export CSV
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[--text-tertiary]" />
        </div>
      )}

      {!loading && data && summary && (
        <>
          {/* Migration banner */}
          {!crmReady && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-600 text-sm">
              Read-only mode — apply supabase/migrations/070_recruiting_crm.sql to enable statuses, notes and outreach logging.
            </div>
          )}

          {/* Stat strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {statCards.map((c) => (
              <button
                key={c.key}
                onClick={c.onClick}
                className={`bg-[--bg-secondary] border rounded-xl p-4 text-left transition-colors hover:border-[--border-secondary] ${
                  c.active ? 'border-[--school-primary]' : 'border-[--border-primary]'
                }`}
              >
                <p className={`text-2xl font-bold ${c.red ? 'text-red-500' : 'text-[--text-primary]'}`}>{c.value}</p>
                <p className="text-xs text-[--text-tertiary] uppercase tracking-wider mt-1">{c.label}</p>
                {c.sub && <p className="text-xs text-[--text-tertiary] mt-0.5">{c.sub}</p>}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2">
            <button onClick={() => setView('pipeline')} className={pillClass(view === 'pipeline')}>
              Pipeline
            </button>
            <button onClick={() => setView('teams')} className={pillClass(view === 'teams')}>
              Teams
            </button>
          </div>

          {view === 'teams' ? (
            <TeamsGrid
              teams={summary.teams}
              crmReady={crmReady}
              actingTeam={actingTeam}
              onTogglePin={handleTogglePin}
              onOpenTeam={handleOpenTeam}
            />
          ) : (
            <>
              {/* Focus 'Today' band */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Today</p>
                {focusRows.length === 0 ? (
                  <p className="text-sm text-[--text-tertiary]">Nothing due — go target an untouched team.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    {focusRows.map((r) => (
                      <div key={r.alumni_id} className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-3">
                        <button
                          onClick={() => setDrawer({ alumniId: r.alumni_id, composerKind: null })}
                          className="block w-full text-left"
                        >
                          <p className="text-sm font-medium text-[--text-primary] truncate">{r.full_name}</p>
                          <p className="text-xs text-[--text-tertiary] truncate">{r.team_key}</p>
                        </button>
                        <p className={`text-xs mt-1 truncate ${isOverdue(r) ? 'text-red-400' : 'text-[--text-secondary]'}`}>
                          {r.crm?.next_action ?? `Follow up — ${r.days_since_touch ?? 0}d quiet`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <button
                            onClick={() => setDrawer({ alumniId: r.alumni_id, composerKind: 'ig_dm' })}
                            className="px-2 py-1 text-xs font-medium text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                          >
                            Log DM
                          </button>
                          <button
                            onClick={() => handleFocusDone(r.alumni_id)}
                            disabled={!crmReady || actingFocus === r.alumni_id}
                            className="px-2 py-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {actingFocus === r.alumni_id ? <Loader2 size={12} className="animate-spin" /> : 'Done'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter row */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-tertiary]" />
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-primary] placeholder:text-[--text-tertiary] focus:outline-none focus:border-[--school-primary]"
                  />
                </div>

                <select
                  value={team}
                  onChange={(e) => { setTeam(e.target.value); setPage(1) }}
                  className="px-3 py-2 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-primary] focus:outline-none focus:border-[--school-primary]"
                >
                  <option value="">All teams</option>
                  {summary.teams.map((t) => (
                    <option key={t.team_key} value={t.team_key}>{`${t.team_key} (${t.roster})`}</option>
                  ))}
                </select>

                <select
                  value={year}
                  onChange={(e) => { setYear(e.target.value); setPage(1) }}
                  className="px-3 py-2 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-primary] focus:outline-none focus:border-[--school-primary]"
                >
                  <option value="">All years</option>
                  {GRAD_YEARS.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>

                <select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value); setPage(1) }}
                  className="px-3 py-2 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-primary] focus:outline-none focus:border-[--school-primary]"
                >
                  <option value="priority">Priority</option>
                  <option value="recent">Recent</option>
                  <option value="name">Name</option>
                  <option value="team">Team</option>
                </select>
              </div>

              {/* Stage tabs */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setStage('all'); setFocusOnly(false); setPage(1) }} className={pillClass(stage === 'all')}>
                  All ({rosterTotal})
                </button>
                {TAB_STAGES.map((s) => (
                  <button key={s} onClick={() => { setStage(s); setFocusOnly(false); setPage(1) }} className={pillClass(stage === s)}>
                    {STAGES[s].label} ({summary.stages[s]})
                  </button>
                ))}
              </div>

              {/* Team strategy card */}
              {team && activeTeamRollup && (
                <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setStrategyOpen((o) => !o)}
                      className="flex items-center gap-2 text-sm font-medium text-[--text-primary]"
                    >
                      {strategyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {team} strategy
                    </button>
                    <button
                      onClick={() => handleTogglePin(activeTeamRollup)}
                      disabled={!crmReady || actingTeam === team}
                      className="p-1.5 rounded hover:bg-[--bg-hover] disabled:opacity-50 transition-colors"
                      title={activeTeamRollup.is_focus ? 'Unpin focus team' : 'Pin as focus team'}
                    >
                      {actingTeam === team ? (
                        <Loader2 size={14} className="animate-spin text-[--text-tertiary]" />
                      ) : (
                        <Pin
                          size={14}
                          className={activeTeamRollup.is_focus ? 'text-[--school-primary]' : 'text-[--text-tertiary]'}
                          fill={activeTeamRollup.is_focus ? 'currentColor' : 'none'}
                        />
                      )}
                    </button>
                  </div>
                  {strategyOpen && (
                    <>
                      <textarea
                        value={strategyNotes}
                        onChange={(e) => setStrategyNotes(e.target.value)}
                        disabled={!crmReady}
                        placeholder="Captains, entry points, locker-room angle."
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-[--bg-primary] border border-[--border-primary] rounded-lg text-[--text-primary] placeholder:text-[--text-tertiary] focus:outline-none focus:border-[--school-primary] disabled:opacity-50 resize-none"
                      />
                      {strategyNotes !== savedStrategyNotes && (
                        <button
                          onClick={handleSaveStrategy}
                          disabled={savingStrategy || !crmReady}
                          className="px-3 py-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg disabled:opacity-50 transition-colors"
                        >
                          {savingStrategy ? <Loader2 size={12} className="animate-spin" /> : 'Save notes'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Table */}
              <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[--border-primary] text-left">
                        <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Athlete</th>
                        <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Team</th>
                        <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Stage</th>
                        <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Last touch</th>
                        <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Next action</th>
                        <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">IG</th>
                        <th className="px-4 py-3 text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[--border-primary]">
                      {data.prospects.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm text-[--text-tertiary]">
                            {stage === 'untouched'
                              ? 'Start with a captain — star one and work outward.'
                              : 'No athletes found'}
                          </td>
                        </tr>
                      ) : (
                        data.prospects.map((r) => {
                          const crm = r.crm
                          const cfg = STAGES[r.effective_stage]
                          const StageIcon = cfg.icon
                          const overdue = isOverdue(r)
                          const igHandle = crm?.instagram_handle?.replace(/^@/, '') ?? null
                          return (
                            <tr
                              key={r.alumni_id}
                              onClick={() => setDrawer({ alumniId: r.alumni_id, composerKind: null })}
                              className="hover:bg-[--bg-hover]/50 transition-colors cursor-pointer"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar name={r.full_name} imageUrl={r.photo_url} size="sm" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="font-medium text-[--text-primary] truncate">{r.full_name}</p>
                                      {crm?.is_captain && (
                                        <Star size={12} className="text-amber-500 flex-shrink-0" fill="currentColor" />
                                      )}
                                    </div>
                                    <p className="text-xs text-[--text-tertiary]">{`'${String(r.graduation_year).slice(-2)}`}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[--text-secondary] whitespace-nowrap">{r.team_key}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${cfg.badge}`}>
                                    <StageIcon size={12} />
                                    {cfg.label}
                                  </span>
                                  {r.match?.tier === 'auto' && (
                                    <span
                                      title="auto-detected"
                                      className="text-[10px] font-medium px-1 py-0.5 rounded bg-zinc-500/10 text-zinc-500"
                                    >
                                      auto
                                    </span>
                                  )}
                                  {r.agreed && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600">
                                      agreed
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-[--text-tertiary] whitespace-nowrap">
                                {r.last_activity
                                  ? `${relativeDate(r.last_activity.occurred_at)} · ${ACTIVITY_KIND_LABELS[r.last_activity.kind] ?? r.last_activity.kind}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-3">
                                {crm && (crm.next_action || crm.next_action_due) ? (
                                  <div>
                                    <p className={`text-sm ${overdue ? 'text-red-400' : 'text-[--text-primary]'}`}>
                                      {crm.next_action ?? 'Follow up'}
                                    </p>
                                    {crm.next_action_due && (
                                      <p className={`text-xs ${overdue ? 'text-red-400' : 'text-[--text-tertiary]'}`}>
                                        Due {formatDue(crm.next_action_due)}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-[--text-tertiary]">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {igHandle ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => handleCopyHandle(e, r)}
                                      className="text-xs text-[--text-secondary] hover:text-[--text-primary] transition-colors"
                                      title="Copy handle"
                                    >
                                      {copiedId === r.alumni_id ? 'Copied!' : `@${igHandle}`}
                                    </button>
                                    <a
                                      href={`https://instagram.com/${igHandle}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[--text-tertiary] hover:text-[--text-primary] transition-colors"
                                      title="Open Instagram"
                                    >
                                      <ExternalLink size={12} />
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-xs text-[--text-tertiary]">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDrawer({ alumniId: r.alumni_id, composerKind: 'ig_dm' })
                                  }}
                                  disabled={!crmReady}
                                  className="p-1.5 rounded text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                                  title="Log outreach"
                                >
                                  <Send size={14} />
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-[--text-tertiary]">
                    Page {page} of {data.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page >= data.totalPages}
                    className="px-3 py-1.5 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Drawer */}
      {drawer && (
        <RecruitingDrawer
          alumniId={drawer.alumniId}
          crmReady={crmReady}
          initialComposerKind={drawer.composerKind}
          onClose={() => setDrawer(null)}
          onChanged={refetchAll}
        />
      )}
    </div>
  )
}
