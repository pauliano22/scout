'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle, Clock, Zap, ChevronDown, ChevronUp, Send, ThumbsUp, ArrowRight, Linkedin, User, MapPin, Calendar, AlertCircle } from 'lucide-react'
import { runScoutNetworkingAgent, DEMO_INPUT } from '@/lib/agent/runScoutNetworkingAgent'
import type { AgentResult, DraftMessage } from '@/lib/agent/types'
import Avatar from '@/components/Avatar'

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  userSport: string | null
  userName: string | null
}

// ─── Small display components ─────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[--school-primary] mb-4">
      {children}
    </p>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 ${className}`}>
      {children}
    </div>
  )
}

function StatusDot({ status }: { status: 'done' | 'pending' | 'waiting' }) {
  const colors = {
    done:    'bg-emerald-500',
    pending: 'bg-amber-500',
    waiting: 'bg-[--school-primary]',
  }
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[status]}`} />
}

// ─── Draft Message Card ───────────────────────────────────────────────────────

function DraftCard({
  draft,
  rank,
  onApprove,
}: {
  draft: DraftMessage
  rank: number
  onApprove: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(rank === 0)

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${
        draft.status === 'approved'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-[--border-primary] bg-[--bg-secondary]'
      }`}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <Avatar name={draft.alumniName} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[--text-primary] truncate">{draft.alumniName}</p>
          <p className="text-xs text-[--text-quaternary] mt-0.5">
            {draft.platform === 'linkedin' ? 'LinkedIn message' : 'Email'}
            {draft.status === 'approved' && (
              <span className="ml-2 text-emerald-400 font-medium">· Approved</span>
            )}
          </p>
        </div>
        {draft.status === 'approved' ? (
          <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
        ) : (
          expanded ? <ChevronUp size={14} className="text-[--text-quaternary]" /> : <ChevronDown size={14} className="text-[--text-quaternary]" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-[--border-primary]">
          <pre className="mt-4 text-sm text-[--text-secondary] whitespace-pre-wrap leading-relaxed font-sans">
            {draft.body}
          </pre>

          {draft.status === 'pending' && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onApprove(draft.id)}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-xs font-semibold"
              >
                <ThumbsUp size={12} />
                Approve &amp; Queue
              </button>
              <button className="btn-secondary flex items-center gap-2 px-4 py-2 text-xs">
                Edit draft
              </button>
            </div>
          )}

          {draft.status === 'approved' && draft.approvedAt && (
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle size={12} />
              Approved — follow-up reminder queued for day 5
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentClient({ userSport, userName }: Props) {
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'done'>('idle')
  const [result, setResult] = useState<AgentResult | null>(null)
  const [drafts, setDrafts] = useState<DraftMessage[]>([])
  const [thinkingStep, setThinkingStep] = useState(0)
  const resultRef = useRef<HTMLDivElement>(null)

  // Fake "Scout is thinking" steps shown while the result is computed
  const thinkingSteps = [
    'Analyzing your career goal…',
    'Searching 14,680+ Cornell alumni profiles…',
    'Scoring by sport, industry, and location…',
    'Selecting your top matches…',
    'Drafting personalized outreach messages…',
    'Building your action plan…',
  ]

  function handleRun() {
    setPhase('thinking')
    setThinkingStep(0)

    // Advance the thinking label every 400ms
    const interval = setInterval(() => {
      setThinkingStep(prev => {
        if (prev >= thinkingSteps.length - 1) {
          clearInterval(interval)
          return prev
        }
        return prev + 1
      })
    }, 420)

    // Actually run the (synchronous) agent after a short delay
    // so the animation has time to play
    setTimeout(() => {
      clearInterval(interval)
      const input = { ...DEMO_INPUT, sport: userSport ?? DEMO_INPUT.sport }
      const agentResult = runScoutNetworkingAgent(input)
      setResult(agentResult)
      setDrafts(agentResult.drafts)
      setPhase('done')
      // Scroll to results
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }, thinkingSteps.length * 420 + 200)
  }

  function handleApprove(draftId: string) {
    setDrafts(prev =>
      prev.map(d =>
        d.id === draftId
          ? { ...d, status: 'approved', approvedAt: new Date().toISOString(), followUpQueuedFor: new Date(Date.now() + 5 * 86400000).toISOString() }
          : d
      )
    )
  }

  const approvedCount = drafts.filter(d => d.status === 'approved').length

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[--bg-primary]">
      {/* ── Header ── */}
      <div className="border-b border-[--border-primary] px-6 py-4 flex items-center gap-3 sticky top-0 bg-[--bg-primary]/90 backdrop-blur z-10">
        <div className="relative w-6 h-6 bg-[--bg-secondary] border border-[--school-primary] rounded-md overflow-hidden flex-shrink-0">
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-[--school-primary] z-10">S</span>
          <span className="absolute top-0 right-0 w-2 h-2 bg-[--school-primary]" />
        </div>
        <span className="text-sm font-bold tracking-tight text-[--text-primary]">Scout</span>
        <span className="text-[--border-secondary] mx-1">·</span>
        <span className="text-sm text-[--text-quaternary]">Networking Agent</span>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[--school-primary]/10 text-[--school-primary] border border-[--school-primary]/20 tracking-wide uppercase">
          Demo
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* ── Intro / Run card ── */}
        {phase === 'idle' && (
          <div className="space-y-8 animate-fade-in-up">
            {/* Hero */}
            <div>
              <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[--school-primary] mb-3">
                Scout Networking Agent
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-[--text-primary] mb-3">
                {userName ? `Hi ${userName.split(' ')[0]}` : 'Ready to work'}. Let Scout do the legwork.
              </h1>
              <p className="text-[--text-secondary] leading-relaxed max-w-lg">
                Tell Scout your goal once. It searches thousands of Cornell alumni, ranks the best fits, and drafts your outreach — so you just review and send.
              </p>
            </div>

            {/* Demo input preview */}
            <Card>
              <SectionLabel>Demo Input</SectionLabel>
              <div className="space-y-3">
                {[
                  ['Goal',        DEMO_INPUT.goal],
                  ['Sport',       DEMO_INPUT.sport],
                  ['Time per week', `${DEMO_INPUT.weekly_time_hours} hrs`],
                  ['Target contacts', `${DEMO_INPUT.target_count} alumni`],
                  ['Industries',  DEMO_INPUT.preferences.industries.join(', ')],
                  ['Locations',   DEMO_INPUT.preferences.locations.join(', ')],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-3 text-sm">
                    <span className="text-[--text-quaternary] w-32 flex-shrink-0">{label}</span>
                    <span className="text-[--text-primary] font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <button
              onClick={handleRun}
              className="btn-primary flex items-center gap-2 px-6 py-3 text-sm font-semibold"
            >
              <Zap size={15} />
              Run Scout Agent
            </button>
          </div>
        )}

        {/* ── Thinking state ── */}
        {phase === 'thinking' && (
          <div className="flex flex-col items-center justify-center py-32 gap-5 animate-fade-in">
            {/* Spinner */}
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-[--border-primary]" />
              <div className="absolute inset-0 rounded-full border-2 border-t-[--school-primary] animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-[--text-primary]">{thinkingSteps[thinkingStep]}</p>
              <p className="text-xs text-[--text-quaternary]">Scout is working…</p>
            </div>
            {/* Completed steps */}
            <div className="mt-4 space-y-1.5">
              {thinkingSteps.slice(0, thinkingStep).map(step => (
                <div key={step} className="flex items-center gap-2 text-xs text-[--text-tertiary]">
                  <CheckCircle size={11} className="text-emerald-500" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {phase === 'done' && result && (
          <div ref={resultRef} className="space-y-10 animate-fade-in-up">

            {/* ── ① GOAL ── */}
            <section>
              <SectionLabel>① Goal</SectionLabel>
              <Card>
                <p className="text-[--text-secondary] leading-relaxed text-sm">{result.goalSummary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {result.input.preferences.industries.map(ind => (
                    <span key={ind} className="tag text-xs">{ind}</span>
                  ))}
                  {result.input.preferences.locations.map(loc => (
                    <span key={loc} className="tag text-xs">📍 {loc}</span>
                  ))}
                </div>
              </Card>
            </section>

            {/* ── ② PLAN ── */}
            <section>
              <SectionLabel>② Plan</SectionLabel>
              <div className="space-y-3">
                {result.plan.map((step, i) => (
                  <Card key={i} className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[--school-primary]/10 border border-[--school-primary]/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-[--school-primary]">W{step.week}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[--text-primary] mb-1">{step.action}</p>
                      <p className="text-xs text-[--text-secondary] leading-relaxed">{step.detail}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            {/* ── ③ TOP ALUMNI ── */}
            <section>
              <SectionLabel>③ Top Alumni Picks</SectionLabel>
              <div className="space-y-3">
                {result.topAlumni.map((alumni, i) => (
                  <Card key={alumni.id} className="flex gap-4 items-start">
                    {/* Rank badge */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[--bg-tertiary] border border-[--border-primary] flex items-center justify-center">
                      <span className="text-[11px] font-bold text-[--text-quaternary]">#{i + 1}</span>
                    </div>

                    {/* Avatar + details */}
                    <Avatar name={alumni.full_name} sport={alumni.sport} size="md" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[--text-primary]">{alumni.full_name}</p>
                        {alumni.linkedin_url && (
                          <a
                            href={alumni.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[--text-quaternary] hover:text-[#0077b5] transition-colors"
                          >
                            <Linkedin size={12} />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-[--text-secondary] mt-0.5">
                        {alumni.role ?? 'Alumni'}{alumni.company ? ` · ${alumni.company}` : ''}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-[--text-quaternary]">{alumni.sport} · Cornell '{String(alumni.graduation_year).slice(2)}</span>
                        {alumni.location && (
                          <span className="text-[10px] text-[--text-quaternary] flex items-center gap-0.5">
                            <MapPin size={9} />
                            {alumni.location.split(',')[0]}
                          </span>
                        )}
                      </div>
                      {/* Score breakdown pills */}
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {alumni.scoreBreakdown.industryMatch > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[--school-primary]/10 text-[--school-primary] border border-[--school-primary]/20 font-medium">
                            Industry match
                          </span>
                        )}
                        {alumni.scoreBreakdown.sportMatch > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                            Shared sport
                          </span>
                        )}
                        {alumni.scoreBreakdown.locationMatch > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            {result.input.preferences.locations.find(l => alumni.location?.toLowerCase().includes(l.toLowerCase()))}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[--text-tertiary] mt-2 italic">{alumni.reason}</p>
                    </div>

                    {/* Match score */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-lg font-bold text-[--school-primary]">{alumni.score}</div>
                      <div className="text-[10px] text-[--text-quaternary]">match score</div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            {/* ── ④ DRAFT OUTREACH ── */}
            <section>
              <SectionLabel>④ Draft Outreach</SectionLabel>
              <div className="space-y-3">
                {drafts.map((draft, i) => (
                  <DraftCard key={draft.id} draft={draft} rank={i} onApprove={handleApprove} />
                ))}
              </div>
              {approvedCount > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 px-1">
                  <CheckCircle size={12} />
                  {approvedCount} draft{approvedCount > 1 ? 's' : ''} approved — follow-up reminders queued.
                </div>
              )}
            </section>

            {/* ── ⑤ SCOUT ALREADY DID ── */}
            <section>
              <SectionLabel>⑤ Scout Already Did</SectionLabel>
              <Card>
                <ul className="space-y-2.5">
                  {result.alreadyDid.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-[--text-secondary]">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>

            {/* ── ⑥ WAITING ON YOU ── */}
            <section>
              <SectionLabel>⑥ Waiting on You</SectionLabel>
              <div className="space-y-3">
                {result.waitingOn.map(item => {
                  const linkedDraft = drafts.find(d => d.id === item.draftId)
                  const isResolved = linkedDraft?.status === 'approved'
                  return (
                    <Card
                      key={item.id}
                      className={`flex items-start gap-3 transition-all ${isResolved ? 'opacity-50' : ''}`}
                    >
                      {isResolved
                        ? <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        : <AlertCircle size={16} className="text-[--school-primary] flex-shrink-0 mt-0.5" />
                      }
                      <div className="flex-1">
                        <p className="text-sm text-[--text-primary]">
                          {isResolved ? <s className="text-[--text-tertiary]">{item.label}</s> : item.label}
                        </p>
                        {isResolved && (
                          <p className="text-xs text-emerald-400 mt-0.5">Done ✓</p>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>

            {/* ── ⑦ NEXT ACTIONS ── */}
            <section>
              <SectionLabel>⑦ Next Actions</SectionLabel>
              <div className="space-y-2">
                {result.nextActions.map(action => {
                  const blocked = !!action.dependsOnApproval && !drafts.some(d => d.id === result.waitingOn.find(w => w.id === action.dependsOnApproval)?.draftId && d.status === 'approved')
                  return (
                    <div
                      key={action.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                        blocked
                          ? 'border-[--border-primary] bg-[--bg-secondary] opacity-40'
                          : 'border-[--border-primary] bg-[--bg-secondary]'
                      }`}
                    >
                      {action.dueInDays === 0
                        ? <ArrowRight size={13} className="text-[--school-primary] flex-shrink-0" />
                        : <Clock size={13} className="text-[--text-quaternary] flex-shrink-0" />
                      }
                      <span className="flex-1 text-sm text-[--text-secondary]">{action.label}</span>
                      <span className="text-[10px] text-[--text-quaternary] font-medium flex-shrink-0">
                        {action.dueInDays === 0 ? 'Now' : `Day ${action.dueInDays}`}
                      </span>
                      {blocked && (
                        <span className="text-[10px] text-[--text-quaternary] italic ml-1">· needs approval</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── Reset ── */}
            <div className="pb-16">
              <button
                onClick={() => { setPhase('idle'); setResult(null); setDrafts([]) }}
                className="btn-ghost text-xs text-[--text-quaternary]"
              >
                ← Reset demo
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
