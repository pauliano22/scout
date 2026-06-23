'use client'

// Home = today's picks. The agent chooses 3-5 alumni (accrued between logins,
// 1/day), each with a one-line why and a draft that writes itself on first
// open. Actions: send (through the ledger-writing approve gate), edit, skip
// (feeds matching). No campaign form exists — targeting lives in a quiet
// preferences sheet; goal/pacing are internal agent state.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Briefcase, Linkedin } from 'lucide-react'
import SportAvatar from '@/components/SportAvatar'
import MessageModal from '@/components/MessageModal'
import AlumniDetailModal from '@/components/AlumniDetailModal'
import { createClient } from '@/lib/supabase/client'
import { CORPUS_INDUSTRIES } from '@/lib/campaign/industries'
import type { Alumni, Profile, UserNetwork } from '@scout/shared/types/database'

interface WarmPath { count: number; topName: string; topRelation: string }
interface Pick {
  queueId: string
  alumnus: Alumni
  why: string
  draftReady: boolean
  warm: WarmPath | null
}
interface PicksPayload {
  picks: Pick[]
  paused: boolean
  field: string | null
  coverage: number | null
  needsField: boolean
}

export default function CampaignClient({ profile }: { profile: Profile }) {
  const supabase = createClient()
  const [data, setData] = useState<PicksPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [sendPick, setSendPick] = useState<{ pick: Pick; draft: string; channel: 'linkedin' | 'email' } | null>(null)
  const [detailAlum, setDetailAlum] = useState<Alumni | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [expandedExp, setExpandedExp] = useState<Set<string>>(new Set())
  const [prefsOpen, setPrefsOpen] = useState(false)

  const toggleExp = (id: string) =>
    setExpandedExp(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const [cityDraft, setCityDraft] = useState('')
  const cityInit = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/picks')
      if (!res.ok) throw new Error(String(res.status))
      const payload = (await res.json()) as PicksPayload
      setData(payload)
      setError(null)
      if (!cityInit.current) {
        cityInit.current = true
        setCityDraft((profile.preferred_locations?.[0] as string) ?? '')
      }
    } catch {
      setError('Could not load your picks.')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { load() }, [load])

  async function openDraft(pick: Pick) {
    setBusy(pick.queueId)
    try {
      const res = await fetch('/api/picks/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: pick.queueId }),
      })
      const body = await res.json()
      if (res.ok) setSendPick({ pick, draft: body.draft ?? '', channel: body.channel ?? 'linkedin' })
    } finally {
      setBusy(null)
    }
  }

  async function handleSend(_id: string, message: string, sentVia: 'linkedin' | 'email' | 'copied' | 'marked') {
    if (!sendPick) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/today/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ action: 'send', queueId: sendPick.pick.queueId, editedBody: message, sentVia }),
    })
    if (res.ok) {
      setData(d => (d ? { ...d, picks: d.picks.filter(p => p.queueId !== sendPick.pick.queueId) } : d))
    }
  }

  async function save(pick: Pick) {
    setBusy(pick.queueId)
    const res = await fetch('/api/picks/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId: pick.queueId, action: 'save' }),
    })
    if (res.ok) setSaved(s => new Set(s).add(pick.queueId))
    setBusy(null)
  }

  async function skip(pick: Pick) {
    setBusy(pick.queueId)
    const res = await fetch('/api/picks/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId: pick.queueId, action: 'skip' }),
    })
    if (res.ok) setData(d => (d ? { ...d, picks: d.picks.filter(p => p.queueId !== pick.queueId) } : d))
    setBusy(null)
  }

  async function patchSettings(patch: Record<string, unknown>) {
    await fetch('/api/picks/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setLoading(true)
    load()
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  if (loading && !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        <div className="skeleton h-8 w-1/2 rounded-lg" />
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="skeleton h-24 w-full rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-[--text-secondary]">{error ?? 'Something went wrong.'}</p>
        <button onClick={() => { setLoading(true); load() }} className="btn-secondary text-sm mt-4">Try again</button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-[--text-primary]">
          Today's picks{firstName !== 'there' ? `, ${firstName}` : ''}.
        </h1>
        <button onClick={() => setPrefsOpen(o => !o)} className="text-sm text-[--text-quaternary] hover:text-[--text-primary] shrink-0">
          Preferences
        </button>
      </div>
      <p className="text-sm text-[--text-tertiary] mt-2 leading-relaxed">
        {data.picks.length > 0
          ? `${data.picks.length} ${data.picks.length === 1 ? 'alum' : 'alumni'} your agent chose today`
          : 'Your agent’s picks'}
        {data.coverage != null && data.field ? `, from ${data.coverage.toLocaleString()} ${data.field} alumni` : ''}
        . Everything you need to reach out — right here.
      </p>

      {/* Inline field capture — one tap, only when we have nothing to target on */}
      {data.needsField && (
        <div className="mt-4 card p-4">
          <p className="text-sm text-[--text-secondary] mb-2.5">Looking at:</p>
          <div className="flex flex-wrap gap-2">
            {CORPUS_INDUSTRIES.map(ind => (
              <button key={ind} onClick={() => patchSettings({ field: ind })} className="btn-secondary text-sm">
                {ind}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quiet preferences sheet */}
      {prefsOpen && (
        <div className="mt-4 card p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[--text-quaternary] mb-2">Field</p>
            <div className="flex flex-wrap gap-2">
              {CORPUS_INDUSTRIES.map(ind => (
                <button
                  key={ind}
                  onClick={() => patchSettings({ field: ind })}
                  className={data.field === ind ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[--text-quaternary] mb-2">Location</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={cityDraft}
                onChange={e => setCityDraft(e.target.value)}
                placeholder="City, region, or state — blank for anywhere"
                className="input-field text-sm flex-1"
              />
              <button onClick={() => patchSettings({ city: cityDraft })} className="btn-secondary text-sm">Save</button>
            </div>
          </div>
          <button
            onClick={() => patchSettings({ paused: !data.paused })}
            className="text-sm text-[--text-tertiary] hover:text-[--text-primary]"
          >
            {data.paused ? 'Resume picks' : 'Pause picks'}
          </button>
        </div>
      )}

      {/* The picks — divider-separated, like Network */}
      <div className="mt-6 divide-y divide-[--border-primary]">
        {data.picks.map(pick => {
          const a = pick.alumnus
          const exp = Array.isArray(a.work_history) ? a.work_history : []
          const expOpen = expandedExp.has(pick.queueId)
          const shownExp = expOpen ? exp : exp.slice(0, 3)
          const isSaved = saved.has(pick.queueId)
          return (
            <div key={pick.queueId} className="py-7">
              {/* Identity */}
              <button onClick={() => setDetailAlum(a)} className="w-full flex items-start gap-3.5 text-left group">
                <SportAvatar
                  name={a.full_name}
                  sport={a.sport}
                  imageUrl={a.photo_url || a.avatar_url}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold tracking-tight text-[--text-primary] leading-tight group-hover:underline">
                    {a.full_name}
                  </div>
                  <div className="text-sm text-[--text-secondary] mt-0.5 leading-snug">
                    {a.role}{a.role && a.company && ' · '}{a.company}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-sm text-[--text-tertiary]">
                    {a.sport && <span>{a.sport}</span>}
                    {a.graduation_year && <span>&apos;{String(a.graduation_year).slice(-2)}</span>}
                    {a.location && <span>{a.location}</span>}
                  </div>
                </div>
              </button>

              {/* Actions — primary, then LinkedIn in the shared secondary style */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => openDraft(pick)}
                  disabled={busy === pick.queueId}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[--school-primary] text-white text-sm font-semibold transition hover:bg-[--school-primary-hover] disabled:opacity-60"
                >
                  {busy === pick.queueId ? 'Writing…' : pick.draftReady ? 'Review & send' : 'Draft intro'}
                </button>
                {a.linkedin_url && (
                  <a
                    href={a.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary w-full flex items-center justify-center gap-2 py-3"
                  >
                    <Linkedin size={15} />
                    LinkedIn
                  </a>
                )}
              </div>

              {/* Add to network — small */}
              <button
                onClick={() => save(pick)}
                disabled={busy === pick.queueId || isSaved}
                className={`mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium transition ${isSaved ? 'text-green-700' : 'text-[--text-tertiary] hover:text-[--text-primary]'}`}
              >
                {isSaved ? '✓ In your network' : '+ Add to network'}
              </button>

              {/* Experience — below the CTA */}
              {exp.length > 0 && (
                <div className="mt-5">
                  <div className="text-[11px] font-bold tracking-[0.09em] text-[--text-quaternary] mb-2.5">EXPERIENCE</div>
                  <div className="space-y-2.5">
                    {shownExp.map((w, i) => (
                      <div key={i} className="flex gap-2.5">
                        <Briefcase size={14} className="text-[--text-quaternary] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm text-[--text-primary] leading-snug">
                            {w.title || '—'}{w.title && w.company && <span className="text-[--text-tertiary]"> · {w.company}</span>}
                          </div>
                          {(w.duration || w.location) && (
                            <div className="text-xs text-[--text-quaternary] mt-0.5">
                              {[w.duration, w.location].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {exp.length > 3 && (
                    <button onClick={() => toggleExp(pick.queueId)} className="mt-2.5 text-[13px] font-semibold text-[--school-primary] hover:underline">
                      {expOpen ? 'Show less ↑' : `Show ${exp.length - 3} more ↓`}
                    </button>
                  )}
                </div>
              )}

              {/* Quiet dismiss */}
              <div className="mt-4">
                <button onClick={() => skip(pick)} disabled={busy === pick.queueId} className="text-[13px] text-[--text-quaternary] hover:text-[--text-tertiary]">
                  Not a fit — skip
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {data.picks.length === 0 && !data.needsField && (
        <p className="mt-6 text-center text-sm text-[--text-tertiary]">
          {data.paused
            ? 'Picks are paused — resume in Preferences when you’re ready.'
            : 'All caught up. New picks land tomorrow.'}
        </p>
      )}

      <p className="mt-8 text-xs text-[--text-quaternary]">Nothing sends without your approval.</p>

      {sendPick && (
        <MessageModal
          connection={{
            id: sendPick.pick.queueId,
            user_id: '',
            alumni_id: sendPick.pick.alumnus.id,
            contacted: false,
            contacted_at: null,
            meeting_at: null,
            notes: null,
            created_at: '',
            alumni: sendPick.pick.alumnus,
          } as UserNetwork}
          userSport={profile?.sport ?? ''}
          initialMessage={sendPick.draft}
          initialPlatform={sendPick.channel}
          initialType="introduction"
          onClose={() => setSendPick(null)}
          onSend={handleSend}
        />
      )}

      {detailAlum && (
        <AlumniDetailModal
          alumni={detailAlum as any}
          isInNetwork={false}
          onAddToNetwork={async () => {}}
          onClose={() => setDetailAlum(null)}
        />
      )}
    </div>
  )
}
