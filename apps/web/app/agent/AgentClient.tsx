'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowRight, Check, Linkedin, MapPin, ChevronRight } from 'lucide-react'
import { runScoutNetworkingAgent } from '@/lib/agent/runScoutNetworkingAgent'
import type { AgentInput } from '@/lib/agent/types'

// ─── Goal presets ─────────────────────────────────────────────────────────────

type GoalPreset = {
  id: string
  label: string
  input: Omit<AgentInput, 'goalDomain'>
}

const GOAL_PRESETS: GoalPreset[] = [
  {
    id: 'sports-marketing',
    label: 'Sports marketing',
    input: {
      goal: 'Break into sports marketing',
      sport: 'Football',
      weekly_time_hours: 2,
      target_count: 3,
      preferences: {
        industries: ['Sports', 'Marketing', 'Media', 'Brand'],
        locations: ['New York', 'Boston'],
        sport: 'Football',
      },
    },
  },
  {
    id: 'finance',
    label: 'Finance',
    input: {
      goal: 'Break into finance',
      sport: 'Football',
      weekly_time_hours: 2,
      target_count: 3,
      preferences: {
        industries: ['Finance', 'Banking', 'Investment', 'Private Equity', 'Wealth'],
        locations: ['New York', 'Boston'],
        sport: 'Football',
      },
    },
  },
  {
    id: 'consulting',
    label: 'Consulting',
    input: {
      goal: 'Break into consulting',
      sport: 'Football',
      weekly_time_hours: 2,
      target_count: 3,
      preferences: {
        industries: ['Consulting', 'McKinsey', 'BCG', 'Bain', 'Deloitte', 'Accenture', 'Oliver Wyman', 'Advisory'],
        locations: ['New York', 'Boston', 'Chicago'],
        sport: 'Football',
      },
    },
  },
  {
    id: 'tech',
    label: 'Tech',
    input: {
      goal: 'Break into tech',
      sport: 'Football',
      weekly_time_hours: 2,
      target_count: 3,
      preferences: {
        industries: ['Technology', 'Software', 'Product', 'Engineering'],
        locations: ['New York', 'San Francisco', 'Seattle'],
        sport: 'Football',
      },
    },
  },
  {
    id: 'media',
    label: 'Media',
    input: {
      goal: 'Break into media',
      sport: 'Football',
      weekly_time_hours: 2,
      target_count: 3,
      preferences: {
        industries: ['Media', 'Journalism', 'Broadcasting', 'Entertainment'],
        locations: ['New York', 'Los Angeles'],
        sport: 'Football',
      },
    },
  },
]
import { agentTrack } from '@/lib/agent/track'
import type { AgentResult, DraftMessage, RankedAlumni } from '@/lib/agent/types'
import Avatar from '@/components/Avatar'

// ─────────────────────────────────────────────────────────────────────────────
// Tiny design primitives
// ─────────────────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[--text-quaternary] mb-3 select-none">
      {children}
    </p>
  )
}

function Rule() {
  return <div className="h-px bg-[--border-primary] my-8" />
}

function TagPill({ label, variant }: { label: string; variant: 'sport' | 'industry' | 'location' }) {
  const color = {
    sport:    'text-blue-400   bg-blue-500/8   border-blue-500/15',
    industry: 'text-[--school-primary] bg-[--school-primary]/8 border-[--school-primary]/15',
    location: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/15',
  }[variant]

  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Alumni row (no card border — just clean list rows)
// ─────────────────────────────────────────────────────────────────────────────

function AlumniRow({
  alumni,
  rank,
  agentRunId,
  goalId,
  onClick,
}: {
  alumni: RankedAlumni
  rank: number
  agentRunId: string
  goalId: string
  onClick?: () => void
}) {
  const city = alumni.location?.split(',')[0]

  return (
    <div
      className="flex items-center gap-4 py-3.5 cursor-default group"
      onClick={() => {
        agentTrack('recommendation_clicked', { agent_run_id: agentRunId, goal_id: goalId, alumni_id: alumni.id })
        onClick?.()
      }}
    >
      {/* Rank */}
      <span className="text-[11px] font-semibold text-[--text-quaternary] w-4 flex-shrink-0 text-right">
        {rank}
      </span>

      {/* Avatar */}
      <Avatar name={alumni.full_name} sport={alumni.sport} size="md" className="flex-shrink-0" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[--text-primary] truncate">{alumni.full_name}</p>
          {alumni.linkedin_url && (
            <a
              href={alumni.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[--text-quaternary] hover:text-[#0077b5] transition-colors flex-shrink-0"
              onClick={e => e.stopPropagation()}
            >
              <Linkedin size={11} />
            </a>
          )}
        </div>
        <p className="text-xs text-[--text-tertiary] truncate mt-0.5">
          {alumni.role && alumni.company
            ? `${alumni.role} · ${alumni.company}`
            : alumni.company ?? alumni.role ?? ''}
        </p>
        <p className="text-[11px] text-[--text-quaternary] mt-1 truncate">{alumni.reason}</p>
      </div>

      {/* Right: tags + location */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <div className="flex gap-1 flex-wrap justify-end">
          {alumni.tags.slice(0, 2).map((tag, i) => (
            <TagPill key={i} label={tag.label} variant={tag.type} />
          ))}
        </div>
        {city && (
          <span className="flex items-center gap-0.5 text-[10px] text-[--text-quaternary]">
            <MapPin size={8} />
            {city}
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft card — one at a time
// ─────────────────────────────────────────────────────────────────────────────

function DraftView({
  draft,
  index,
  total,
  result,
  onApprove,
  onSkip,
}: {
  draft: DraftMessage
  index: number
  total: number
  result: AgentResult
  onApprove: (id: string) => void
  onSkip: (id: string) => void
}) {
  const [justApproved, setJustApproved] = useState(false)

  // Find this draft's alumni so we can get their LinkedIn URL
  const alumni = result.topAlumni.find(a => a.id === draft.alumniId)

  async function handleApprove() {
    agentTrack('draft_approved', {
      agent_run_id: result.agentRunId,
      goal_id:      result.goalId,
      alumni_id:    draft.alumniId,
      draft_id:     draft.id,
    })

    // 1. Copy the message to the clipboard
    try {
      await navigator.clipboard.writeText(draft.body)
    } catch {
      // Clipboard API blocked (e.g. iframe) — silent fail, message is still visible
    }

    // 2. Open LinkedIn profile in a new tab so user can paste and send
    if (alumni?.linkedin_url) {
      window.open(alumni.linkedin_url, '_blank', 'noopener,noreferrer')
    }

    setJustApproved(true)
    setTimeout(() => {
      setJustApproved(false)
      onApprove(draft.id)
    }, 700)
  }

  function handleSkip() {
    agentTrack('draft_skipped', {
      agent_run_id: result.agentRunId,
      goal_id:      result.goalId,
      alumni_id:    draft.alumniId,
      draft_id:     draft.id,
    })
    onSkip(draft.id)
  }

  useEffect(() => {
    agentTrack('draft_viewed', {
      agent_run_id: result.agentRunId,
      goal_id:      result.goalId,
      alumni_id:    draft.alumniId,
      draft_id:     draft.id,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Label>Draft ready</Label>
        <span className="text-[11px] text-[--text-quaternary]">
          {draft.alumniName.split(' ')[0]}  ·  {index + 1} of {total}
        </span>
      </div>

      {/* Message body */}
      <div className="bg-[--bg-secondary] rounded-xl border border-[--border-primary] px-6 py-5">
        <pre className="text-sm text-[--text-secondary] whitespace-pre-wrap font-sans leading-[1.7]">
          {draft.body}
        </pre>
      </div>

      {/* Actions */}
      <div className="mt-4 space-y-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleApprove}
            disabled={justApproved}
            className={`btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all ${
              justApproved ? 'bg-emerald-600' : ''
            }`}
          >
            {justApproved ? (
              <><Check size={13} /> Copied &amp; opening LinkedIn</>
            ) : (
              <>Approve &amp; send</>
            )}
          </button>

          {total > 1 && (
            <button
              onClick={handleSkip}
              className="btn-ghost flex items-center gap-1.5 text-sm text-[--text-quaternary]"
            >
              Skip
              <ChevronRight size={13} />
            </button>
          )}
        </div>

        {/* Hint — shown only when LinkedIn URL is available */}
        {alumni?.linkedin_url && !justApproved && (
          <p className="text-[11px] text-[--text-quaternary]">
            Copies the message and opens {alumni.full_name.split(' ')[0]}'s LinkedIn. Just paste and send.
          </p>
        )}
        {!alumni?.linkedin_url && !justApproved && (
          <p className="text-[11px] text-[--text-quaternary]">
            Copies the message. Paste it into LinkedIn to send.
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Status strip — 3 rows, deliberately quiet
// ─────────────────────────────────────────────────────────────────────────────

function StatusStrip({
  result,
  approvedCount,
}: {
  result: AgentResult
  approvedCount: number
}) {
  const waitingText = approvedCount === result.drafts.length
    ? 'All drafts ready for you to send'
    : approvedCount > 0
      ? `${approvedCount} of ${result.drafts.length} ready to send`
      : result.status.waiting

  return (
    <div className="space-y-2.5">
      {[
        { label: 'Prepared',   value: result.status.prepared },
        { label: 'Waiting',    value: waitingText },
        { label: 'Next',       value: approvedCount > 0 ? result.status.next : 'Waiting for approval' },
      ].map(({ label, value }) => (
        <div key={label} className="flex items-baseline gap-3 text-sm">
          <span className="text-[--text-quaternary] w-20 flex-shrink-0 text-xs">{label}</span>
          <span className="text-[--text-secondary]">{value}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Running animation
// ─────────────────────────────────────────────────────────────────────────────

const THINKING_STEPS = [
  'Reading your goal…',
  'Searching 14,680 alumni profiles…',
  'Scoring by sport, industry, location…',
  'Selecting your top 3 matches…',
  'Drafting outreach messages…',
]

function RunningView() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => setStep(s => Math.min(s + 1, THINKING_STEPS.length - 1)), 420)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
      {/* Minimal pulse */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[--school-primary] animate-pulse"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[--text-primary]">{THINKING_STEPS[step]}</p>
        <p className="text-xs text-[--text-quaternary] mt-1">Scout is working</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Complete view — drafts prepared, student sends (honest: nothing is auto-sent,
// and Scout cannot detect replies without the CASA-gated Gmail read scope)
// ─────────────────────────────────────────────────────────────────────────────

function CompleteView({ result, onReset }: { result: AgentResult; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 text-center animate-fade-in-up">
      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
        <Check size={18} className="text-emerald-400" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold text-[--text-primary]">{result.drafts.length} drafts ready for you to review and send.</p>
        <p className="text-sm text-[--text-secondary]">Send the ones you like, then mark anyone who replies so I can line up your next move.</p>
      </div>
      <button onClick={onReset} className="btn-ghost text-sm text-[--text-quaternary] mt-2">
        ← Start over
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  userSport: string | null
  userName: string | null
}

type Phase = 'ready' | 'running' | 'result' | 'complete'

export default function AgentClient({ userSport, userName }: Props) {
  const [phase, setPhase]             = useState<Phase>('ready')
  const [result, setResult]           = useState<AgentResult | null>(null)
  const [draftIndex, setDraftIndex]   = useState(0)
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set())
  const [selectedGoalId, setSelectedGoalId] = useState('sports-marketing')
  const resultRef = useRef<HTMLDivElement>(null)

  const selectedPreset = GOAL_PRESETS.find(p => p.id === selectedGoalId) ?? GOAL_PRESETS[0]
  // Override sport with user's real sport if available
  const activeInput = { ...selectedPreset.input, sport: userSport ?? selectedPreset.input.sport }

  async function handleRun() {
    agentTrack('agent_run_started', { goal: activeInput.goal, user_sport: activeInput.sport })
    setPhase('running')

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: activeInput }),
      })
      if (!res.ok) throw new Error('API error')
      const { result: r } = await res.json()

      agentTrack('agent_run_completed', {
        agent_run_id: r.agentRunId,
        goal_id:      r.goalId,
        alumni_count: r.topAlumni.length,
      })
      agentTrack('recommendations_generated', {
        agent_run_id: r.agentRunId,
        goal_id:      r.goalId,
        alumni_ids:   r.topAlumni.map((a: { id: string }) => a.id),
      })
      setResult(r)
      setPhase('result')
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    } catch {
      // Fall back to mock data if API fails
      const r = runScoutNetworkingAgent(activeInput)
      setResult(r)
      setPhase('result')
    }
  }

  function handleApprove(draftId: string) {
    const newApproved = new Set([...approvedIds, draftId])
    setApprovedIds(newApproved)

    // Schedule follow-up tracking
    const draft = result?.drafts.find(d => d.id === draftId)
    if (draft && result) {
      const followUpDate = new Date(Date.now() + 5 * 86400000).toISOString()
      agentTrack('followup_scheduled', {
        agent_run_id: result.agentRunId,
        goal_id:      result.goalId,
        alumni_id:    draft.alumniId,
        due_date:     followUpDate,
      })
    }

    // Advance to next draft or complete
    if (result && newApproved.size >= result.drafts.length) {
      setTimeout(() => setPhase('complete'), 400)
    } else {
      const next = result?.drafts.findIndex((d, i) => i > draftIndex && !newApproved.has(d.id))
      if (next !== undefined && next >= 0) setDraftIndex(next)
    }
  }

  function handleSkip(draftId: string) {
    const next = result?.drafts.findIndex((d, i) => i > draftIndex && !approvedIds.has(d.id))
    if (next !== undefined && next >= 0) setDraftIndex(next)
  }

  function handleReset() {
    setPhase('ready')
    setResult(null)
    setDraftIndex(0)
    setApprovedIds(new Set())
  }

  function handleSelectGoal(id: string) {
    setSelectedGoalId(id)
    // Reset results if we switch goals after a run
    if (phase === 'result' || phase === 'complete') {
      setPhase('ready')
      setResult(null)
      setDraftIndex(0)
      setApprovedIds(new Set())
    }
  }

  // The active draft shown in the draft section
  const activeDraft = result?.drafts[draftIndex]
  const approvedCount = approvedIds.size

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[--bg-primary]">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-10 bg-[--bg-primary]/90 backdrop-blur border-b border-[--border-primary]">
        <div className="max-w-2xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Scout logo mark */}
            <div className="relative w-5 h-5 rounded-[4px] bg-[--bg-secondary] border border-[--school-primary] overflow-hidden flex-shrink-0">
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-[--school-primary] z-10">S</span>
              <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-[--school-primary]" />
            </div>
            <span className="text-sm font-bold tracking-tight text-[--text-primary]">Scout</span>
            <span className="text-[--border-secondary] mx-0.5 text-xs">·</span>
            <span className="text-xs text-[--text-quaternary]">Networking Agent</span>
          </div>
          <span className="text-[9px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 rounded-full bg-[--bg-tertiary] text-[--text-quaternary] border border-[--border-primary]">
            Demo
          </span>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-2xl mx-auto px-6 pb-24">

        {/* ════════════════ READY ════════════════ */}
        {phase === 'ready' && (
          <div className="pt-20 animate-fade-in-up">
            <Label>Your goal</Label>
            <h1 className="text-3xl font-bold tracking-tight text-[--text-primary] leading-snug">
              {selectedPreset.input.goal}.
            </h1>
            <p className="text-sm text-[--text-secondary] mt-3 leading-relaxed">
              Scout finds strong Cornell alumni contacts, ranks them, and preps the outreach before you lift a finger.
            </p>

            {/* Goal selector */}
            <div className="flex items-center gap-2 mt-6 flex-wrap">
              {GOAL_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectGoal(preset.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                    selectedGoalId === preset.id
                      ? 'bg-[--school-primary] text-white border-transparent'
                      : 'bg-[--bg-secondary] text-[--text-secondary] border-[--border-primary] hover:border-[--border-secondary]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {[
                `${activeInput.weekly_time_hours} hrs / week`,
                activeInput.preferences.locations.join(' · '),
                activeInput.preferences.sport ?? activeInput.sport,
              ].map(tag => (
                <span key={tag} className="text-xs text-[--text-quaternary] bg-[--bg-secondary] border border-[--border-primary] px-2.5 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>

            <button
              onClick={handleRun}
              className="btn-primary flex items-center gap-2 mt-8 px-6 py-3 text-sm font-semibold"
            >
              Run Scout
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* ════════════════ RUNNING ════════════════ */}
        {phase === 'running' && <RunningView />}

        {/* ════════════════ COMPLETE ════════════════ */}
        {phase === 'complete' && result && (
          <CompleteView result={result} onReset={handleReset} />
        )}

        {/* ════════════════ RESULT ════════════════ */}
        {phase === 'result' && result && (
          <div ref={resultRef} className="pt-12 animate-fade-in-up">

            {/* Goal bar */}
            <div className="mb-1">
              <h2 className="text-xl font-bold tracking-tight text-[--text-primary]">
                {result.input.goal}.
              </h2>
              <p className="text-xs text-[--text-quaternary] mt-1">
                {result.input.preferences.locations.join(' · ')}
                {result.input.preferences.sport && ` · ${result.input.preferences.sport}`}
              </p>
            </div>

            <Rule />

            {/* ── NEXT MOVE ── */}
            <section>
              <Label>Next move</Label>
              <p className="text-xl font-semibold text-[--text-primary] leading-snug tracking-tight">
                {result.nextStep.headline}
              </p>
              <p className="text-sm text-[--text-secondary] mt-1.5">
                {result.nextStep.subline}
              </p>
              <button
                className="mt-4 btn-primary flex items-center gap-2 text-sm font-semibold px-5 py-2.5"
                onClick={() => {
                  document.getElementById('draft-section')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                Review draft
                <ArrowRight size={13} />
              </button>
            </section>

            <Rule />

            {/* ── BEST MATCHES ── */}
            <section>
              <Label>Best matches</Label>
              <div className="divide-y divide-[--border-primary]">
                {result.topAlumni.map((alumni, i) => (
                  <AlumniRow
                    key={alumni.id}
                    alumni={alumni}
                    rank={i + 1}
                    agentRunId={result.agentRunId}
                    goalId={result.goalId}
                  />
                ))}
              </div>
            </section>

            <Rule />

            {/* ── DRAFT ── */}
            <section id="draft-section">
              {activeDraft && (
                <DraftView
                  draft={activeDraft}
                  index={draftIndex}
                  total={result.drafts.length}
                  result={result}
                  onApprove={handleApprove}
                  onSkip={handleSkip}
                />
              )}
            </section>

            <Rule />

            {/* ── STATUS ── */}
            <section>
              <Label>Status</Label>
              <StatusStrip result={result} approvedCount={approvedCount} />
            </section>

            {/* Reset */}
            <div className="mt-10">
              <button
                onClick={handleReset}
                className="text-xs text-[--text-quaternary] hover:text-[--text-tertiary] transition-colors"
              >
                ← Reset demo
              </button>
            </div>

          </div>
        )}

      </main>
    </div>
  )
}
