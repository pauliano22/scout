'use client'

// The campaign home — an agentic status report, not a dashboard. Reads
// /api/campaign and renders: goal + progress, a plain-language narrative of what
// Scout did, the cron-prepared drafts to review & send (human-in-the-loop, no
// auto-send), the who-to-contact approval shelf, and a muted "waiting" list.
// Sends/approvals go through /api/today/approve (the single service-side gate
// that also writes the cross-user ledger). Reuses MessageModal + AlumniDetailModal.

import { useCallback, useEffect, useState } from 'react'
import Avatar from '@/components/Avatar'
import MessageModal from '@/components/MessageModal'
import AlumniDetailModal from '@/components/AlumniDetailModal'
import GoalSetup from './GoalSetup'
import { createClient } from '@/lib/supabase/client'
import type { Alumni, Profile, UserNetwork } from '@scout/shared/types/database'

interface ReadyItem {
  queueId: string
  channel: 'email' | 'linkedin'
  messageType: 'introduction' | 'follow_up' | 'thank_you'
  draftBody: string
  why: string | null
  alumnus: Alumni
}
interface ProposedItem { networkId: string; alumnus: Alumni; why: string | null }
interface WaitingItem { alumniId: string; reason: string; daysWaiting?: number; alumnus: Alumni | null }
interface Campaign {
  goalMetric: string
  goalCount: number
  deadline: string
  status: string
  booked: number
  meetingsSet: number
  weeksLeft: number
}
interface Payload { campaign: Campaign | null; ready: ReadyItem[]; proposed: ProposedItem[]; waiting: WaitingItem[] }

const GOAL_LABEL: Record<string, string> = {
  informational_interview: 'informational interviews',
  referral: 'referrals',
  mentor_relationship: 'mentor relationships',
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const subtitle = (a: Alumni) => [a.role, a.company].filter(Boolean).join(' · ') || a.sport

export default function CampaignClient({ profile }: { profile: Profile }) {
  const supabase = createClient()
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendItem, setSendItem] = useState<ReadyItem | null>(null)
  const [detailAlum, setDetailAlum] = useState<Alumni | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/campaign')
      if (!res.ok) throw new Error('load failed')
      setData(await res.json())
      setError(null)
    } catch {
      setError('Could not load your campaign.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function post(body: Record<string, unknown>): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/today/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    })
    return res.ok
  }

  async function handleSend(_c: string, message: string, sentVia: 'linkedin' | 'email' | 'copied' | 'marked') {
    if (!sendItem) return
    const ok = await post({ action: 'send', queueId: sendItem.queueId, editedBody: message, sentVia })
    if (ok) setData((d) => (d ? { ...d, ready: d.ready.filter((r) => r.queueId !== sendItem.queueId) } : d))
  }

  async function dismissDraft(queueId: string) {
    setBusy(queueId)
    const ok = await post({ action: 'dismiss_draft', queueId })
    if (ok) setData((d) => (d ? { ...d, ready: d.ready.filter((r) => r.queueId !== queueId) } : d))
    setBusy(null)
  }

  async function actOnTarget(networkId: string, action: 'approve_target' | 'dismiss_target') {
    setBusy(networkId)
    const ok = await post({ action, networkId })
    if (ok) setData((d) => (d ? { ...d, proposed: d.proposed.filter((p) => p.networkId !== networkId) } : d))
    setBusy(null)
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        <div className="skeleton h-9 w-2/3 rounded-lg" />
        <div className="skeleton h-28 w-full rounded-2xl" />
        <div className="skeleton h-20 w-full rounded-2xl" />
        <div className="skeleton h-20 w-full rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-[--text-secondary]">{error ?? 'Something went wrong.'}</p>
        <button onClick={load} className="btn-secondary text-sm mt-4">Try again</button>
      </div>
    )
  }

  // ── No goal yet (or editing) → the self-serve goal step ──────────────────────
  if (!data.campaign || editingGoal) {
    return <GoalSetup profile={profile} onComplete={() => { setEditingGoal(false); load() }} />
  }

  const c = data.campaign
  const pct = c.goalCount > 0 ? Math.min(100, Math.round((c.booked / c.goalCount) * 100)) : 0
  const readyCount = data.ready.length
  const proposedCount = data.proposed.length
  const nothingToDo = readyCount === 0 && proposedCount === 0 && data.waiting.length === 0

  const narrative =
    readyCount > 0 && proposedCount > 0
      ? `Since you were away, I drafted ${plural(readyCount, 'intro', 'intros')} for you to send and lined up ${plural(proposedCount, 'alum', 'alumni')} to approve.`
      : readyCount > 0
        ? `I have ${plural(readyCount, 'draft', 'drafts')} ready for you to review and send.`
        : proposedCount > 0
          ? `I lined up ${plural(proposedCount, 'alum', 'alumni')} who fit — approve the ones you like and I'll draft the intros.`
          : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[--text-primary]">Welcome back, {firstName}.</h1>

      {/* Goal + progress */}
      <div className="mt-6 bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[--text-primary] font-medium">
            {c.goalCount} {GOAL_LABEL[c.goalMetric] ?? 'connections'}
          </p>
          <button onClick={() => setEditingGoal(true)} className="text-xs text-[--text-quaternary] hover:text-[--text-secondary] shrink-0">Adjust goal</button>
        </div>
        <div className="mt-3 h-2 rounded-full bg-[--bg-tertiary] overflow-hidden">
          <div className="h-full rounded-full bg-[--school-primary] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-[--text-tertiary] mt-2">
          <span className="text-[--text-secondary] font-medium">{c.booked} of {c.goalCount}</span> booked
          <span className="text-[--text-quaternary]"> (you logged it)</span>
          {c.weeksLeft > 0 && ` · ${plural(c.weeksLeft, 'week', 'weeks')} left`}
          {c.meetingsSet > 0 && ` · ${c.meetingsSet} scheduled`}
        </p>
      </div>

      {/* Narrative */}
      {narrative && <p className="text-[--text-secondary] leading-relaxed mt-6">{narrative}</p>}

      {/* Ready to send */}
      {readyCount > 0 && (
        <>
          <h2 className="text-xs font-semibold tracking-wider uppercase text-[--text-quaternary] mt-8 mb-3">Ready for you to send</h2>
          <div className="space-y-3">
            {data.ready.map((item) => (
              <div key={item.queueId} className="bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-4 transition-colors hover:border-[--border-secondary]">
                <button onClick={() => setDetailAlum(item.alumnus)} className="w-full flex items-start gap-3 text-left">
                  <Avatar name={item.alumnus.full_name} sport={item.alumnus.sport} imageUrl={item.alumnus.avatar_url || item.alumnus.photo_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[--text-primary] truncate">{item.alumnus.full_name}</div>
                    <div className="text-sm text-[--text-tertiary] truncate">{subtitle(item.alumnus)}</div>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold tracking-wider uppercase text-[--text-quaternary] border border-[--border-primary] rounded-full px-2 py-1">{item.channel}</span>
                </button>

                <button onClick={() => setExpanded(expanded === item.queueId ? null : item.queueId)} className="mt-3 w-full text-left">
                  <div className={`text-sm text-[--text-secondary] leading-relaxed whitespace-pre-line ${expanded === item.queueId ? '' : 'line-clamp-2'}`}>{item.draftBody}</div>
                  <span className="text-xs text-[--text-quaternary] mt-1 inline-block">{expanded === item.queueId ? 'Hide draft' : 'Read full draft'}</span>
                </button>

                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => setSendItem(item)} className="btn-primary text-sm">Review &amp; send</button>
                  <button onClick={() => dismissDraft(item.queueId)} disabled={busy === item.queueId} className="btn-ghost text-sm ml-auto">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Approval shelf */}
      {proposedCount > 0 && (
        <>
          <h2 className="text-xs font-semibold tracking-wider uppercase text-[--text-quaternary] mt-8 mb-3">Scout lined these up · approve to add</h2>
          <div className="space-y-3">
            {data.proposed.map((p) => (
              <div key={p.networkId} className="bg-[--bg-secondary]/60 border border-dashed border-[--border-primary] rounded-2xl p-4">
                <button onClick={() => setDetailAlum(p.alumnus)} className="w-full flex items-start gap-3 text-left">
                  <Avatar name={p.alumnus.full_name} sport={p.alumnus.sport} imageUrl={p.alumnus.avatar_url || p.alumnus.photo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[--text-primary] truncate">{p.alumnus.full_name}</div>
                    <div className="text-sm text-[--text-tertiary] truncate">{subtitle(p.alumnus)}</div>
                    {p.why && <div className="text-[13px] text-[--text-secondary] mt-1.5">{p.why}</div>}
                  </div>
                </button>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => actOnTarget(p.networkId, 'approve_target')} disabled={busy === p.networkId}
                    className="text-sm font-medium px-4 py-2 rounded-xl border border-[--school-primary] text-[--school-primary] transition hover:bg-[--school-primary]/5">
                    Add to outreach
                  </button>
                  <button onClick={() => actOnTarget(p.networkId, 'dismiss_target')} disabled={busy === p.networkId} className="btn-ghost text-sm ml-auto">Not now</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Waiting on replies */}
      {data.waiting.length > 0 && (
        <>
          <h2 className="text-xs font-semibold tracking-wider uppercase text-[--text-quaternary] mt-8 mb-3">Waiting on replies</h2>
          <div className="space-y-2">
            {data.waiting.filter((w) => w.alumnus).map((w) => (
              <div key={w.alumniId} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[--bg-secondary]/50 border border-[--border-primary]">
                <Avatar name={w.alumnus!.full_name} sport={w.alumnus!.sport} imageUrl={w.alumnus!.avatar_url || w.alumnus!.photo_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[--text-secondary] truncate">{w.alumnus!.full_name}</div>
                  <div className="text-xs text-[--text-quaternary] truncate">{w.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state — goal set, nothing queued yet */}
      {nothingToDo && (
        <div className="mt-8 bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-6 text-center">
          <p className="text-[--text-primary] font-medium">Scout is working your campaign.</p>
          <p className="text-sm text-[--text-tertiary] mt-1.5 leading-relaxed">
            Nothing is queued right now — Scout surfaces only genuine matches, never filler. If your focus is narrow, broadening the field or city gives it more to work with.
          </p>
          <button onClick={() => setEditingGoal(true)} className="btn-secondary text-sm mt-4">Adjust or broaden goal</button>
        </div>
      )}

      <p className="text-xs text-[--text-quaternary] mt-8 leading-relaxed">
        Prepared for you — nothing is sent until you send it, and no one is contacted until you approve them. Scout drafts; you’re the author and the closer.
      </p>

      {/* Modals */}
      {sendItem && (
        <MessageModal
          connection={{
            id: sendItem.queueId,
            user_id: '',
            alumni_id: sendItem.alumnus.id,
            contacted: false,
            contacted_at: null,
            meeting_at: null,
            notes: null,
            created_at: '',
            alumni: sendItem.alumnus,
          } as UserNetwork}
          userSport={profile?.sport ?? ''}
          initialMessage={sendItem.draftBody}
          initialPlatform={sendItem.channel}
          initialType={sendItem.messageType}
          onClose={() => setSendItem(null)}
          onSend={handleSend}
        />
      )}

      {detailAlum && (
        <AlumniDetailModal
          alumni={detailAlum}
          isInNetwork
          onAddToNetwork={async () => {}}
          onClose={() => setDetailAlum(null)}
        />
      )}
    </div>
  )
}
