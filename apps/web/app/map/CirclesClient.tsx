'use client'

// Circles — role-aware browsing home.
// Students land on the "Where your team went" board; alumni land on their
// locker room. Picking ANY person opens the standard alumni detail modal
// (same as Discover/Campaign), hydrated with the live DB row — the baked map
// dataset carries no linkedin_url or fresh career fields. The one exception:
// an alum opening their own circle (?sel=self) still gets the season view.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/track'
import AlumniDetailModal, { type AlumniBase } from '@/components/AlumniDetailModal'
import type { WorkHistoryEntry } from '@scout/shared/types/database'
import { loadDataset, type Dataset } from './_lib/data'
import type { Person, SavedContact } from './_lib/types'
import { sportIndicesFor } from './_lib/sportMatch'
import { teammates } from './_lib/overlap'
import SearchHero from './_components/SearchHero'
import PersonCircle from './_components/PersonCircle'
import LockerRoom from './_components/LockerRoom'
import TeamBoard from './_components/TeamBoard'
import './circles.css'

// The board runs on the baked map dataset; the shared detail modal expects a
// DB-shaped alumni row. Bridge the field names (condensed keys → row keys).
function toAlumniBase(ds: Dataset, p: Person): AlumniBase {
  const work: WorkHistoryEntry[] = (p.wh ?? []).map(w => ({
    title: w.t ?? null,
    company: w.c ?? null,
    start: w.s ? { year: w.s } : null,
    end: w.e ? { year: w.e } : null,
    duration: null,
    location: null,
  }))
  return {
    id: p.id,
    full_name: p.n,
    company: p.co ?? null,
    role: p.ro ?? null,
    industry: p.in != null ? ds.data.industries[p.in] : null,
    sport: ds.data.sports[p.sp[0]] ?? '',
    graduation_year: p.y ?? 0,
    linkedin_url: p.li ?? null,
    location: p.lo ?? null,
    photo_url: p.av ?? null,
    display_headline: p.hl ?? null,
    work_history: work.length ? work : null,
  }
}

// Live row wins field-by-field; bake values only fill fields the DB has blank.
function mergeAlum(base: AlumniBase, fresh?: Partial<AlumniBase>): AlumniBase {
  if (!fresh) return base
  const out: AlumniBase = { ...base }
  for (const [k, v] of Object.entries(fresh)) {
    if (v != null && v !== '') (out as unknown as Record<string, unknown>)[k] = v
  }
  return out
}

export default function CirclesClient({
  userId,
  saved,
  selfAlumniId = null,
  role = 'student',
  studentSport = null,
}: {
  userId: string
  saved: SavedContact[]
  selfAlumniId?: string | null
  role?: 'student' | 'alumni' | 'admin'
  studentSport?: string | null
}) {
  const [ds, setDs] = useState<Dataset | null>(null)
  const [error, setError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savedList, setSavedList] = useState<SavedContact[]>(saved)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveErrorTimer = useRef<number>()

  // Upsert, not insert: agent-proposed / not-interested rows are filtered out
  // of `saved` server-side, so they render as unsaved here — saving one is an
  // approval (proposed → interested), and a bare insert would hit the
  // (user_id, alumni_id) unique key and silently roll the pill back forever.
  const save = useCallback(async (alumniId: string) => {
    setSavedList(list => list.some(s => s.alumniId === alumniId) ? list : [...list, { alumniId, status: 'interested' }])
    const { error } = await createClient()
      .from('user_networks')
      .upsert({ user_id: userId, alumni_id: alumniId, status: 'interested' }, { onConflict: 'user_id,alumni_id' })
    if (error) {
      setSavedList(list => list.filter(s => s.alumniId !== alumniId))
      setSaveError("Couldn't save — tap Save to retry.")
      window.clearTimeout(saveErrorTimer.current)
      saveErrorTimer.current = window.setTimeout(() => setSaveError(null), 6000)
    } else {
      trackEvent('alumni_added_to_network', { alumni_id: alumniId, source: 'circles' })
    }
  }, [userId])

  useEffect(() => {
    loadDataset().then(setDs).catch(err => { console.error(err); setError(true) })
    trackEvent('circles_viewed')
    const sel = new URLSearchParams(location.search).get('sel')
    if (sel) setSelectedId(sel)
  }, [])

  useEffect(() => {
    const url = selectedId ? `?sel=${selectedId}` : location.pathname
    history.replaceState(null, '', url)
    if (selectedId) trackEvent('circles_profile_viewed', { alumni_id: selectedId })
  }, [selectedId])

  const selfPerson = ds && selfAlumniId ? ds.byId.get(selfAlumniId) ?? null : null
  const studentIndices = useMemo(
    () => (ds && role === 'student' ? sportIndicesFor(ds, studentSport) : []),
    [ds, role, studentSport],
  )

  // A handful of alumni have no campus window or no teammates on record, and a
  // sport can in principle match with zero industry data — those landings
  // would render empty, so fall back to the search-first view instead.
  const lockerViable = useMemo(
    () => !!ds && !!selfPerson && selfPerson.a != null && teammates(ds, selfPerson).length > 0,
    [ds, selfPerson],
  )
  const boardViable = useMemo(() => {
    if (!ds || !studentIndices.length) return false
    for (const s of studentIndices) {
      for (const i of ds.sportBuckets[s]) {
        const p = ds.data.alumni[i]
        if (p.in != null && (p.ro || p.co)) return true
      }
    }
    return false
  }, [ds, studentIndices])

  const person = ds && selectedId ? ds.byId.get(selectedId) ?? null : null
  // Only the self view replaces the page; every other person is a modal, so
  // the landing (board / locker room) stays mounted underneath.
  const selfView = !!person && !!selfAlumniId && person.id === selfAlumniId
  const showLocker = !!ds && role === 'alumni' && lockerViable && !selfView
  const showBoard = !!ds && role === 'student' && boardViable

  // Hydrate the modal with the live alumni row (linkedin, fresh role/company,
  // dated work history) — cached per id for the session.
  const [liveAlum, setLiveAlum] = useState<Record<string, Partial<AlumniBase>>>({})
  const detailId = person && !selfView ? person.id : null
  useEffect(() => {
    if (!detailId || liveAlum[detailId]) return
    let cancelled = false
    fetch(`/api/alumni/${detailId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        if (!cancelled && body?.alumni) setLiveAlum(m => ({ ...m, [detailId]: body.alumni }))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [detailId, liveAlum])

  useEffect(() => {
    if (showLocker) trackEvent('circles_lockerroom_viewed')
  }, [showLocker])
  useEffect(() => {
    if (showBoard) trackEvent('circles_board_viewed', { sport: studentSport })
  }, [showBoard, studentSport])

  if (error) {
    return <div className="circles"><p className="circles-status">Couldn&apos;t load alumni data. Refresh to retry.</p></div>
  }
  if (!ds) {
    return <div className="circles"><p className="circles-status">Loading alumni…</p></div>
  }

  return (
    <div className={`circles${showLocker || showBoard ? ' circles-wide' : ''}`}>
      <div className="circles-narrow">
        <header className="circles-head">
          <h1>Circles</h1>
          <p className="circles-sub">Who played with whom, season by season.</p>
        </header>

        <SearchHero ds={ds} onPick={p => setSelectedId(p.id)} />

        {saveError && (
          <button className="circles-savefail" onClick={() => setSaveError(null)}>
            {saveError}
          </button>
        )}

        {role === 'student' && savedList.length === 0 && !person && (
          <p className="circles-nudge" role="status">
            Save anyone you&apos;d want an intro to — each save unlocks warm intro paths on every profile.
          </p>
        )}
      </div>

      {selfView ? (
        <div className="circles-narrow">
          <button className="circles-back" onClick={() => setSelectedId(null)}>
            ← Back
          </button>
          <PersonCircle
            ds={ds}
            person={person!}
            saved={savedList}
            onSave={save}
            onPick={p => setSelectedId(p.id)}
            self
          />
        </div>
      ) : showLocker ? (
        <LockerRoom ds={ds} self={selfPerson!} onPick={p => setSelectedId(p.id)} />
      ) : showBoard ? (
        <TeamBoard
          ds={ds}
          sportIndices={studentIndices}
          saved={savedList}
          onSave={save}
          onPick={p => setSelectedId(p.id)}
        />
      ) : (
        <div className="circles-narrow">
          <div className="web-empty">
            <p>Search any Cornell athlete above to see who they played with, season by season.</p>
          </div>
        </div>
      )}

      {person && !selfView && (
        <AlumniDetailModal
          key={person.id}
          alumni={mergeAlum(toAlumniBase(ds, person), liveAlum[person.id])}
          isInNetwork={savedList.some(s => s.alumniId === person.id)}
          onAddToNetwork={save}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
