'use client'

// Home = today's picks. The agent chooses 3-5 alumni (accrued between logins,
// 1/day), each with a one-line why and a draft that writes itself on first
// open. Actions: send (through the ledger-writing approve gate), edit, skip
// (feeds matching). No campaign form exists — targeting lives in a quiet
// preferences sheet; goal/pacing are internal agent state.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from '@/components/Link'
import Avatar from '@/components/Avatar'
import SportIcon from '@/components/SportIcon'
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

export default function CampaignClient({ profile, waitingCount }: { profile: Profile; waitingCount: number }) {
  const supabase = createClient()
  const [data, setData] = useState<PicksPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [sendPick, setSendPick] = useState<{ pick: Pick; draft: string; channel: 'linkedin' | 'email' } | null>(null)
  const [detailAlum, setDetailAlum] = useState<Alumni | null>(null)
  const [prefsOpen, setPrefsOpen] = useState(false)
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
        <h1 className="text-2xl font-semibold tracking-tight text-[--text-primary]">
          Today's picks{firstName !== 'there' ? `, ${firstName}` : ''}.
        </h1>
        <button onClick={() => setPrefsOpen(o => !o)} className="text-xs text-[--text-quaternary] hover:text-[--text-secondary] shrink-0">
          Preferences
        </button>
      </div>
      <p className="text-sm text-[--text-tertiary] mt-1">
        Chosen for you — a new pick lands each day.
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

      {/* The picks */}
      <div className="mt-6 space-y-3">
        {data.picks.map(pick => {
          const warmFirstName = pick.warm?.topName.split(' ')[0] ?? ''
          return (
            <div key={pick.queueId} className="card pick-card p-5">
              <button onClick={() => setDetailAlum(pick.alumnus)} className="w-full flex items-start gap-4 text-left">
                <div className="relative shrink-0">
                  <Avatar
                    name={pick.alumnus.full_name}
                    imageUrl={pick.alumnus.photo_url || pick.alumnus.avatar_url}
                    size="lg"
                  />
                  {pick.alumnus.sport && (
                    <span
                      className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-[--bg-primary] ring-1 ring-[--border-primary] flex items-center justify-center text-[--text-secondary]"
                      title={pick.alumnus.sport}
                    >
                      <SportIcon sport={pick.alumnus.sport} size={13} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[--text-primary] truncate">{pick.alumnus.full_name}</div>
                  <div className="text-sm text-[--text-secondary] mt-1 leading-relaxed">{pick.why}</div>
                  {pick.warm && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[--text-tertiary]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {pick.warm.topRelation === 'teammate'
                        ? `${warmFirstName} played with them`
                        : `${warmFirstName} overlapped at Cornell`}
                      {pick.warm.topRelation === 'teammate' && pick.warm.count > 1
                        ? ` · +${pick.warm.count - 1} more`
                        : ''}
                    </div>
                  )}
                </div>
              </button>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => openDraft(pick)}
                  disabled={busy === pick.queueId}
                  className="btn-primary text-sm"
                >
                  {busy === pick.queueId ? 'Writing…' : pick.draftReady ? 'Review & send' : 'Draft intro'}
                </button>
                <button onClick={() => skip(pick)} disabled={busy === pick.queueId} className="btn-ghost text-sm ml-auto">
                  Skip
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {data.picks.length === 0 && !data.needsField && (
        <div className="mt-6 card p-6 text-center">
          <p className="text-[--text-primary] font-medium">
            {data.paused ? 'Picks are paused.' : 'All caught up.'}
          </p>
          <p className="text-sm text-[--text-tertiary] mt-1.5">
            {data.paused ? 'Resume in Preferences when you’re ready.' : 'New picks land tomorrow.'}
          </p>
        </div>
      )}

      {waitingCount > 0 && (
        <Link
          href="/network"
          className="mt-8 flex items-center gap-1.5 text-sm font-medium text-[--school-primary] hover:opacity-80 transition-opacity"
        >
          {waitingCount} {waitingCount === 1 ? 'person is' : 'people are'} waiting on your reply
          <span aria-hidden>→</span>
        </Link>
      )}

      <p className={`${waitingCount > 0 ? 'mt-3' : 'mt-8'} text-xs text-[--text-quaternary]`}>Nothing sends without your approval.</p>

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
