'use client'

// Circles — the one-purpose page: pick an alum, see who they played with
// (season by season), and the warm paths through your own saved network.
// No map, no filter rail. Search → circle. Saved network → the web.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/track'
import { loadDataset, type Dataset } from './_lib/data'
import type { SavedContact } from './_lib/types'
import SearchHero from './_components/SearchHero'
import PersonCircle from './_components/PersonCircle'
import NetworkWeb from './_components/NetworkWeb'
import './circles.css'

export default function CirclesClient({ userId, saved }: { userId: string; saved: SavedContact[] }) {
  const [ds, setDs] = useState<Dataset | null>(null)
  const [error, setError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savedList, setSavedList] = useState<SavedContact[]>(saved)

  // Saving from a circle adds to the network and grows the web in place.
  const save = useCallback(async (alumniId: string) => {
    setSavedList(list => list.some(s => s.alumniId === alumniId) ? list : [...list, { alumniId, status: 'interested' }])
    const { error } = await createClient().from('user_networks').insert({ user_id: userId, alumni_id: alumniId })
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

  if (error) {
    return <div className="circles"><p className="circles-status">Couldn't load alumni data. Refresh to retry.</p></div>
  }
  if (!ds) {
    return <div className="circles"><p className="circles-status">Loading alumni…</p></div>
  }

  const person = selectedId ? ds.byId.get(selectedId) ?? null : null
  const showOnboarding = !person && savedList.length < 1

  return (
    <div className="circles">
      <header className="circles-head">
        <h1>Circles</h1>
        <p className="circles-sub">Who played with whom, season by season.</p>
      </header>

      <SearchHero ds={ds} onPick={p => setSelectedId(p.id)} />

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
        <>
          <button className="circles-back" onClick={() => setSelectedId(null)}>
            ← {savedList.length >= 2 ? 'Back to your web' : 'Back'}
          </button>
          <PersonCircle ds={ds} person={person} saved={savedList} onSave={save} onPick={p => setSelectedId(p.id)} />
        </>
      ) : (
        <NetworkWeb ds={ds} saved={savedList} onPick={p => setSelectedId(p.id)} />
      )}
    </div>
  )
}
