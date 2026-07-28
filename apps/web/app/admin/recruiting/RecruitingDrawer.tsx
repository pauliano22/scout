'use client'

// Slide-over detail drawer for the Recruiting CRM: identity header, stage
// stepper (derived stages locked), CRM fields, activity composer + timeline,
// and the Scout match panel with confirm/reject/unlink.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Ban,
  Calendar,
  Check,
  Instagram,
  Linkedin,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Star,
  UserPlus,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import Avatar from '@/components/Avatar'
import type { EffectiveStage, ProspectRow } from '@/lib/recruiting/merge'
import type {
  RecruitingActivity,
  RecruitingActivityKind,
  RecruitingActivityOutcome,
  RecruitingProspect,
} from '@scout/shared/types/database'
import {
  ACTIVITY_KIND_LABELS,
  ACTIVITY_OUTCOME_LABELS,
  STAGES,
  STAGE_ORDER,
  relativeDate,
} from './stageConfig'

interface Suggestion {
  profile_id: string
  full_name: string
  email: string | null
  sport: string | null
  graduation_year: number | null
  reason: string
}

interface DrawerData {
  prospect: ProspectRow
  activities: RecruitingActivity[]
  suggestions: Suggestion[]
  crmReady: boolean
}

const KIND_ICONS: Record<RecruitingActivityKind, LucideIcon> = {
  ig_dm: Instagram,
  in_person: Users,
  teammate_intro: UserPlus,
  captain_intro: Star,
  event: Calendar,
  email: Mail,
  other: MessageSquare,
}

const OUTCOME_BADGES: Record<RecruitingActivityOutcome, string> = {
  no_reply: 'bg-zinc-500/10 text-zinc-500',
  replied_positive: 'bg-emerald-500/10 text-emerald-600',
  replied_negative: 'bg-red-500/10 text-red-400',
  agreed_to_join: 'bg-emerald-500/10 text-emerald-600',
  met: 'bg-emerald-500/10 text-emerald-600',
}

const INPUT_CLASSES =
  'w-full px-3 py-2 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-primary] placeholder:text-[--text-tertiary] focus:outline-none focus:border-[--school-primary] disabled:opacity-50'

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function RecruitingDrawer({
  alumniId,
  crmReady,
  initialComposerKind = null,
  onClose,
  onChanged,
}: {
  alumniId: string
  crmReady: boolean
  initialComposerKind?: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const [data, setData] = useState<DrawerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  // Editable field state (synced from the CRM row on load).
  const [notes, setNotes] = useState('')
  const [savedNotes, setSavedNotes] = useState('')
  const [igHandle, setIgHandle] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextActionDue, setNextActionDue] = useState('')

  // Activity composer state.
  const [composerKind, setComposerKind] = useState<string>(initialComposerKind ?? 'ig_dm')
  const [composerOutcome, setComposerOutcome] = useState('')
  const [composerNote, setComposerNote] = useState('')
  const [composerDate, setComposerDate] = useState(localToday())

  const seqRef = useRef(0)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const scrolledRef = useRef(false)

  const fetchDetail = useCallback(
    async (resetFields: boolean) => {
      const seq = ++seqRef.current
      if (resetFields) {
        setLoading(true)
        setError(null)
      }
      try {
        const res = await fetch(`/api/admin/recruiting/${alumniId}`)
        const json = await res.json()
        if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to load prospect')
        if (seq !== seqRef.current) return
        const payload = json.data as DrawerData
        setData(payload)
        if (resetFields) {
          const crm = payload.prospect.crm
          setNotes(crm?.notes ?? '')
          setSavedNotes(crm?.notes ?? '')
          setIgHandle(crm?.instagram_handle ?? '')
          setContactEmail(crm?.contact_email ?? '')
          setNextAction(crm?.next_action ?? '')
          setNextActionDue(crm?.next_action_due ?? '')
        }
      } catch (e) {
        if (seq === seqRef.current) setError(e instanceof Error ? e.message : 'Failed to load prospect')
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    },
    [alumniId],
  )

  // Load on mount + whenever the target prospect changes; reset the composer.
  useEffect(() => {
    setComposerKind(initialComposerKind ?? 'ig_dm')
    setComposerOutcome('')
    setComposerNote('')
    setComposerDate(localToday())
    void fetchDetail(true)
  }, [alumniId, initialComposerKind, fetchDetail])

  // Escape closes the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // When opened straight into the composer, bring it into view once.
  useEffect(() => {
    if (initialComposerKind && data && !scrolledRef.current) {
      scrolledRef.current = true
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [initialComposerKind, data])

  const row = data?.prospect ?? null
  const crm = row?.crm ?? null
  const match = row?.match ?? null
  const writable = crmReady && (data?.crmReady ?? false)

  // Derived stages always win for display; manual status underneath otherwise.
  const effectiveStage: EffectiveStage = row
    ? row.effective_stage === 'signed_up' || row.effective_stage === 'activated'
      ? row.effective_stage
      : crm?.status ?? 'untouched'
    : 'untouched'
  const derivedActive = effectiveStage === 'signed_up' || effectiveStage === 'activated'
  const currentIdx = STAGE_ORDER.indexOf(effectiveStage)
  const isNotNow = crm?.status === 'not_now'

  async function patchProspect(
    body: Record<string, unknown>,
    actKey: string,
    refetch = false,
  ): Promise<RecruitingProspect | null> {
    if (!writable || acting) return null
    setActing(actKey)
    setError(null)
    try {
      const res = await fetch(`/api/admin/recruiting/${alumniId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Update failed')
      const prospect = json.data.prospect as RecruitingProspect
      setData(prev => (prev ? { ...prev, prospect: { ...prev.prospect, crm: prospect } } : prev))
      if (refetch) await fetchDetail(false)
      onChanged()
      return prospect
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
      return null
    } finally {
      setActing(null)
    }
  }

  async function handleIgBlur() {
    const baseline = crm?.instagram_handle ?? ''
    const next = igHandle.trim().replace(/^@/, '')
    if (next === baseline) return
    const p = await patchProspect({ instagram_handle: next || null }, 'instagram')
    if (p) setIgHandle(p.instagram_handle ?? '')
  }

  async function handleEmailBlur() {
    const baseline = crm?.contact_email ?? ''
    const next = contactEmail.trim().toLowerCase()
    if (next === baseline) return
    const p = await patchProspect({ contact_email: next || null }, 'contact_email')
    if (p) setContactEmail(p.contact_email ?? '')
  }

  function handleNextActionBlur() {
    const baseline = crm?.next_action ?? ''
    if (nextAction.trim() === baseline) return
    void patchProspect({ next_action: nextAction.trim() || null }, 'next_action')
  }

  async function handleSaveNotes() {
    const p = await patchProspect({ notes: notes.trim() || null }, 'notes')
    if (p) {
      setNotes(p.notes ?? '')
      setSavedNotes(p.notes ?? '')
    }
  }

  async function handleLogActivity() {
    if (!writable || acting) return
    setActing('log')
    setError(null)
    try {
      const body: Record<string, unknown> = { kind: composerKind }
      if (composerOutcome) body.outcome = composerOutcome
      if (composerNote.trim()) body.body = composerNote.trim()
      if (composerDate && composerDate !== localToday()) {
        body.occurred_at = new Date(`${composerDate}T12:00:00`).toISOString()
      }
      const res = await fetch(`/api/admin/recruiting/${alumniId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to log activity')
      setComposerOutcome('')
      setComposerNote('')
      setComposerDate(localToday())
      await fetchDetail(false)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log activity')
    } finally {
      setActing(null)
    }
  }

  const notesDirty = notes !== savedNotes

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative ml-auto h-full w-full max-w-md bg-[--bg-primary] border-l border-[--border-primary] overflow-y-auto"
      >
        {/* ── Identity header ── */}
        {row ? (
          <div className="flex items-start gap-3 p-5 border-b border-[--border-primary]">
            <Avatar name={row.full_name} imageUrl={row.photo_url} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[--text-primary] truncate">{row.full_name}</h2>
                {row.linkedin_url && (
                  <a
                    href={row.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="LinkedIn profile"
                    className="text-[--text-tertiary] hover:text-[--school-primary] flex-shrink-0"
                  >
                    <Linkedin size={16} />
                  </a>
                )}
              </div>
              <p className="text-sm text-[--text-secondary] truncate">
                {row.sport} · {`'${String(row.graduation_year).slice(-2)}`}
              </p>
              {row.location && <p className="text-xs text-[--text-tertiary] mt-0.5 truncate">{row.location}</p>}
            </div>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded hover:bg-[--bg-hover] text-[--text-tertiary] flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end p-5 border-b border-[--border-primary]">
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded hover:bg-[--bg-hover] text-[--text-tertiary]"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {error && (
          <div className="m-5 mb-0 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading || !row ? (
          loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-[--text-tertiary]" />
            </div>
          ) : null
        ) : (
          <div className="p-5 space-y-6">
            {/* ── Stage stepper ── */}
            <section>
              <h3 className="text-xs font-medium text-[--text-tertiary] uppercase tracking-wider mb-3">Stage</h3>
              <div className="flex">
                {STAGE_ORDER.map((stage, i) => {
                  const cfg = STAGES[stage]
                  const isCurrent = stage === effectiveStage
                  const reached = currentIdx >= 0 && i <= currentIdx
                  const StageIcon = cfg.icon
                  const dotClasses = isCurrent
                    ? 'bg-[--school-primary] border-[--school-primary] text-white'
                    : reached
                      ? 'bg-[--bg-primary] border-[--school-primary] text-[--school-primary]'
                      : 'bg-[--bg-secondary] border-[--border-secondary] text-[--text-quaternary]'
                  const dotInner =
                    acting === `status:${stage}` ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : reached || isCurrent ? (
                      <StageIcon size={12} />
                    ) : cfg.derived ? (
                      <Lock size={11} />
                    ) : null
                  return (
                    <div key={stage} className="relative flex-1 flex flex-col items-center">
                      {i > 0 && (
                        <div
                          className={`absolute top-3.5 right-1/2 h-px w-full ${
                            reached ? 'bg-[--school-primary]' : 'bg-[--border-primary]'
                          }`}
                        />
                      )}
                      {cfg.derived ? (
                        <div
                          title="Set automatically"
                          className={`relative z-10 w-7 h-7 rounded-full border flex items-center justify-center ${dotClasses}`}
                        >
                          {dotInner}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (!isCurrent) void patchProspect({ status: stage }, `status:${stage}`)
                          }}
                          disabled={!writable || derivedActive || acting !== null}
                          title={derivedActive ? 'Set automatically' : `Set stage: ${cfg.label}`}
                          className={`relative z-10 w-7 h-7 rounded-full border flex items-center justify-center transition-colors disabled:cursor-not-allowed ${dotClasses} ${
                            writable && !derivedActive ? 'hover:border-[--school-primary]' : 'disabled:opacity-70'
                          }`}
                        >
                          {dotInner}
                        </button>
                      )}
                      <span
                        className={`mt-1 text-[10px] text-center leading-tight ${
                          isCurrent ? 'text-[--text-primary] font-medium' : 'text-[--text-tertiary]'
                        }`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={() => void patchProspect({ status: isNotNow ? 'untouched' : 'not_now' }, 'not_now')}
                disabled={!writable || derivedActive || acting !== null}
                className={`mt-3 px-3 py-1.5 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isNotNow
                    ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30 hover:bg-zinc-500/20'
                    : 'bg-[--bg-secondary] text-[--text-secondary] border-[--border-primary] hover:text-[--text-primary] hover:bg-[--bg-hover]'
                }`}
              >
                {acting === 'not_now' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Ban size={12} />
                )}
                {isNotNow ? 'Back in play' : 'Mark not now'}
              </button>
            </section>

            {/* ── Fields ── */}
            <section className="space-y-4">
              <h3 className="text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Details</h3>

              <div className="flex items-center justify-between">
                <span className="text-sm text-[--text-secondary]">Captain</span>
                <button
                  onClick={() => void patchProspect({ is_captain: !(crm?.is_captain ?? false) }, 'captain')}
                  disabled={!writable || acting !== null}
                  title={crm?.is_captain ? 'Unmark captain' : 'Mark as captain'}
                  className="p-1.5 rounded hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {acting === 'captain' ? (
                    <Loader2 size={16} className="animate-spin text-[--text-tertiary]" />
                  ) : (
                    <Star
                      size={16}
                      className={crm?.is_captain ? 'text-amber-500 fill-amber-500' : 'text-[--text-quaternary]'}
                    />
                  )}
                </button>
              </div>

              <div>
                <label className="block text-xs text-[--text-tertiary] mb-1">Instagram</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[--text-tertiary]">@</span>
                  <input
                    type="text"
                    value={igHandle}
                    onChange={e => setIgHandle(e.target.value)}
                    onBlur={() => void handleIgBlur()}
                    disabled={!writable}
                    placeholder="handle"
                    className={`${INPUT_CLASSES} pl-7`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[--text-tertiary] mb-1">Email</label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    onBlur={() => void handleEmailBlur()}
                    disabled={!writable}
                    placeholder="netid@cornell.edu"
                    className={`${INPUT_CLASSES} flex-1`}
                  />
                  {crm?.contact_email && (
                    <a
                      href={`mailto:${crm.contact_email}`}
                      className="p-1.5 rounded text-[--text-tertiary] hover:text-[--text-primary] hover:bg-[--bg-hover]"
                      title={`Email ${row.full_name}`}
                    >
                      <Mail size={16} />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-[--text-tertiary] mb-1">Next action</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nextAction}
                    onChange={e => setNextAction(e.target.value)}
                    onBlur={handleNextActionBlur}
                    disabled={!writable}
                    placeholder="DM after practice…"
                    className={`${INPUT_CLASSES} flex-1`}
                  />
                  <input
                    type="date"
                    value={nextActionDue}
                    onChange={e => {
                      setNextActionDue(e.target.value)
                      void patchProspect({ next_action_due: e.target.value || null }, 'next_action_due')
                    }}
                    disabled={!writable}
                    className={`${INPUT_CLASSES} w-36 flex-shrink-0`}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-[--text-tertiary]">Notes</label>
                  {notesDirty && (
                    <button
                      onClick={() => void handleSaveNotes()}
                      disabled={!writable || acting !== null}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[--school-primary] text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {acting === 'notes' && <Loader2 size={12} className="animate-spin" />}
                      Save
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  disabled={!writable}
                  placeholder="Context, mutuals, angle…"
                  className={`${INPUT_CLASSES} resize-y`}
                />
              </div>
            </section>

            {/* ── Activity composer ── */}
            <section ref={composerRef} className="space-y-2">
              <h3 className="text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Log outreach</h3>
              <div className="flex gap-2">
                <select
                  value={composerKind}
                  onChange={e => setComposerKind(e.target.value)}
                  disabled={!writable}
                  className={`${INPUT_CLASSES} flex-1`}
                >
                  {Object.entries(ACTIVITY_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={composerOutcome}
                  onChange={e => setComposerOutcome(e.target.value)}
                  disabled={!writable}
                  className={`${INPUT_CLASSES} flex-1`}
                >
                  <option value="">No outcome</option>
                  {Object.entries(ACTIVITY_OUTCOME_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={composerNote}
                  onChange={e => setComposerNote(e.target.value)}
                  disabled={!writable}
                  placeholder="What happened?"
                  className={`${INPUT_CLASSES} flex-1`}
                />
                <input
                  type="date"
                  value={composerDate}
                  onChange={e => setComposerDate(e.target.value)}
                  disabled={!writable}
                  className={`${INPUT_CLASSES} w-36 flex-shrink-0`}
                />
              </div>
              <button
                onClick={() => void handleLogActivity()}
                disabled={!writable || acting !== null}
                className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-[--school-primary] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              >
                {acting === 'log' && <Loader2 size={14} className="animate-spin" />}
                Log activity
              </button>
            </section>

            {/* ── Timeline ── */}
            <section>
              <h3 className="text-xs font-medium text-[--text-tertiary] uppercase tracking-wider mb-2">Timeline</h3>
              {data && data.activities.length > 0 ? (
                <div className="divide-y divide-[--border-primary]">
                  {data.activities.map(activity => {
                    const KindIcon = KIND_ICONS[activity.kind]
                    return (
                      <div key={activity.id} className="py-3 flex gap-3">
                        <KindIcon size={16} className="text-[--text-tertiary] mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[--text-primary]">
                              {ACTIVITY_KIND_LABELS[activity.kind]}
                            </span>
                            {activity.outcome && (
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${OUTCOME_BADGES[activity.outcome]}`}
                              >
                                {ACTIVITY_OUTCOME_LABELS[activity.outcome]}
                              </span>
                            )}
                            <span className="ml-auto text-xs text-[--text-tertiary] flex-shrink-0">
                              {relativeDate(activity.occurred_at)}
                            </span>
                          </div>
                          {activity.body && (
                            <p className="text-sm text-[--text-secondary] mt-0.5">{activity.body}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-[--text-tertiary]">No outreach logged yet.</p>
              )}
            </section>

            {/* ── Scout panel ── */}
            <section className="space-y-2">
              <h3 className="text-xs font-medium text-[--text-tertiary] uppercase tracking-wider">Scout</h3>
              {match ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        match.tier === 'confirmed'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {match.tier === 'confirmed' ? 'Confirmed' : 'auto — confirm?'}
                    </span>
                    <a
                      href={`/admin/users?search=${encodeURIComponent(row.full_name)}`}
                      className="text-xs font-medium text-[--school-primary] hover:underline"
                    >
                      View in Users →
                    </a>
                  </div>
                  {match.activated && (
                    <p className="text-sm font-bold text-emerald-600 inline-flex items-center gap-1">
                      <Zap size={14} /> Activated
                    </p>
                  )}
                  <div className="text-sm text-[--text-secondary] space-y-1">
                    {match.student_email && (
                      <p className="text-[--text-primary] font-medium truncate">{match.student_email}</p>
                    )}
                    <p>Joined {relativeDate(match.joined_at)}</p>
                    <p className="inline-flex items-center gap-1.5">
                      {match.onboarding_completed ? (
                        <>
                          <Check size={14} className="text-emerald-600" /> Onboarding complete
                        </>
                      ) : (
                        <span className="text-[--text-tertiary]">Onboarding incomplete</span>
                      )}
                    </p>
                    <p>First save: {match.first_save_at ? relativeDate(match.first_save_at) : '—'}</p>
                    <p>
                      First message: {match.first_message_at ? relativeDate(match.first_message_at) : '—'}
                    </p>
                  </div>
                  {match.tier === 'auto' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() =>
                          void patchProspect(
                            { confirm_profile_id: match.profile_id },
                            `confirm:${match.profile_id}`,
                            true,
                          )
                        }
                        disabled={!writable || acting !== null}
                        className="px-3 py-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {acting === `confirm:${match.profile_id}` && (
                          <Loader2 size={12} className="animate-spin" />
                        )}
                        Confirm — same person
                      </button>
                      <button
                        onClick={() =>
                          void patchProspect(
                            { reject_profile_id: match.profile_id },
                            `reject:${match.profile_id}`,
                            true,
                          )
                        }
                        disabled={!writable || acting !== null}
                        className="px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:bg-[--bg-hover] rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {acting === `reject:${match.profile_id}` && (
                          <Loader2 size={12} className="animate-spin" />
                        )}
                        Not them
                      </button>
                    </div>
                  )}
                  {match.tier === 'confirmed' && (
                    <button
                      onClick={() => void patchProspect({ clear_match: true }, 'unlink', true)}
                      disabled={!writable || acting !== null}
                      className="px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:bg-[--bg-hover] rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {acting === 'unlink' && <Loader2 size={12} className="animate-spin" />}
                      Unlink
                    </button>
                  )}
                </div>
              ) : data && data.suggestions.length > 0 ? (
                data.suggestions.map(s => (
                  <div key={s.profile_id} className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-medium text-[--text-primary]">{s.full_name}</p>
                    <p className="text-xs text-[--text-secondary] truncate">
                      {[s.email, s.sport, s.graduation_year].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-[--text-tertiary]">{s.reason}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          void patchProspect({ confirm_profile_id: s.profile_id }, `confirm:${s.profile_id}`, true)
                        }
                        disabled={!writable || acting !== null}
                        className="px-3 py-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {acting === `confirm:${s.profile_id}` && <Loader2 size={12} className="animate-spin" />}
                        Confirm — same person
                      </button>
                      <button
                        onClick={() =>
                          void patchProspect({ reject_profile_id: s.profile_id }, `reject:${s.profile_id}`, true)
                        }
                        disabled={!writable || acting !== null}
                        className="px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:bg-[--bg-hover] rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {acting === `reject:${s.profile_id}` && <Loader2 size={12} className="animate-spin" />}
                        Not them
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[--text-tertiary]">Not on Scout yet.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
