'use client'

// Circles — role-aware browsing home.
// Students: "Where your team went" board (their sport's alumni by destination),
//   search, and their saved-network web. Alumni: "Your locker room" (their
//   teammates by class cohort). Picking any person opens their season circle.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/track'
import { loadDataset, type Dataset } from './_lib/data'
import type { SavedContact } from './_lib/types'
import { sportIndicesFor } from './_lib/sportMatch'
import { teammates } from './_lib/overlap'
import SearchHero from './_components/SearchHero'
import PersonCircle from './_components/PersonCircle'
import NetworkWeb from './_components/NetworkWeb'
import LockerRoom from './_components/LockerRoom'
import TeamBoard from './_components/TeamBoard'
import './circles.css'

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

  // Saving from a circle adds to the network and grows the web in place.
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
  const showLocker = !!ds && !person && role === 'alumni' && lockerViable
  const showBoard = !!ds && !person && role === 'student' && boardViable

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

  // The 4-step "build your network" walkthrough is student framing for the
  // search-first landing; skip it whenever a richer landing is available.
  const showOnboarding = !person && savedList.length < 1 && !selfAlumniId && !boardViable

  return (
    <div className={`circles${showLocker || showBoard ? ' circles-wide' : ''}`}>
      <div className="circles-narrow">
        <header className="circles-head">
          <h1>Circles</h1>
          <p className="circles-sub">Who played with whom, season by season.</p>
        </header>

        <SearchHero ds={ds} onPick={p => setSelectedId(p.id)} />
      </div>

      {showOnboarding && (
        <div className="circles-onboarding" role="status">
          <div className="onboarding-steps">
            <div className="onboarding-step">
              <span className="onboarding-num">1</span>
              <span>Search any Cornell athlete above by name or company</span>
            </div>
            <div className="onboarding-step">
              <span className="onboarding-num">2</span>
              <span>See who they played with, season by season</span>
            </div>
            <div className="onboarding-step">
              <span className="onboarding-num">3</span>
              <span><strong>Save</strong> contacts you want to connect with and your network&apos;s web builds itself</span>
            </div>
            <div className="onboarding-step">
              <span className="onboarding-num">4</span>
              <span>Find <strong>warm intro paths</strong> through people you already know</span>
            </div>
          </div>
          <p className="onboarding-hint">
            Already have saved contacts? <em>Select one from above to see their circle.</em>
          </p>
        </div>
      )}

      {person ? (
        <div className="circles-narrow">
          <button className="circles-back" onClick={() => setSelectedId(null)}>
            ← {role === 'alumni' || boardViable || savedList.length < 2 ? 'Back' : 'Back to your web'}
          </button>
          <PersonCircle
            ds={ds}
            person={person}
            saved={savedList}
            onSave={save}
            onPick={p => setSelectedId(p.id)}
            self={person.id === selfAlumniId}
          />
        </div>
      ) : showLocker ? (
        <LockerRoom ds={ds} self={selfPerson!} onPick={p => setSelectedId(p.id)} />
      ) : showBoard ? (
        <>
          <TeamBoard
            ds={ds}
            sportIndices={studentIndices}
            saved={savedList}
            onSave={save}
            onPick={p => setSelectedId(p.id)}
          />
          {savedList.length >= 2 && (
            <div className="circles-narrow" style={{ marginTop: 48 }}>
              <NetworkWeb ds={ds} saved={savedList} onPick={p => setSelectedId(p.id)} />
            </div>
          )}
        </>
      ) : (
        <NetworkWeb ds={ds} saved={savedList} onPick={p => setSelectedId(p.id)} />
      )}
    </div>
  )
}
