import { useEffect, useMemo, useState } from 'react'
import type { Dataset } from '../data'
import type { Person } from '../types'
import { introCandidates, sameEra, seasonsShared, teammates } from '../overlap'
import { useAppDispatch, useAppState } from '../state'
import TeamTimeline from './TeamTimeline'

interface Props {
  ds: Dataset
  filteredSet: Set<number>
  hasActiveFilters: boolean
}

function PersonRow({ ds, p, note, onPick }: { ds: Dataset; p: Person; note?: string; onPick: (p: Person) => void }) {
  return (
    <button className="person-row" onClick={() => onPick(p)}>
      <span className="person-row-name">{p.n}{p.y ? ` '${String(p.y).slice(2)}` : ''}</span>
      <span className="person-row-meta">
        {note ?? [ds.data.sports[p.sp[0]], p.co].filter(Boolean).join(' · ')}
      </span>
    </button>
  )
}

function PersonList({ ds, people, onPick, noteFor }: {
  ds: Dataset
  people: Person[]
  onPick: (p: Person) => void
  noteFor?: (p: Person) => string | undefined
}) {
  const [shown, setShown] = useState(25)
  if (!people.length) return <p className="muted">None found.</p>
  return (
    <>
      {people.slice(0, shown).map(p => (
        <PersonRow key={p.id} ds={ds} p={p} note={noteFor?.(p)} onPick={onPick} />
      ))}
      {people.length > shown && (
        <button className="link-btn" onClick={() => setShown(s => s + 50)}>
          Show more ({(people.length - shown).toLocaleString()} remaining)
        </button>
      )}
    </>
  )
}

export default function DetailPanel({ ds, filteredSet, hasActiveFilters }: Props) {
  const { selectedId, finderOpen, filters } = useAppState()
  const dispatch = useAppDispatch()
  const p = selectedId ? ds.byId.get(selectedId) : undefined
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!p || finderOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dispatch({ type: 'select', id: null }) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [p, finderOpen, dispatch])

  useEffect(() => { setCopied(false) }, [selectedId])

  const mates = useMemo(
    () => (p ? teammates(ds, p).sort((a, b) => seasonsShared(p, b) - seasonsShared(p, a) || (b.y ?? 0) - (a.y ?? 0)) : []),
    [ds, p]
  )
  const era = useMemo(() => (p ? sameEra(ds, p) : []), [ds, p])
  const intros = useMemo(
    () => (p && hasActiveFilters ? introCandidates(ds, p, filteredSet) : []),
    [ds, p, filteredSet, hasActiveFilters]
  )

  if (!p) return null

  const pick = (q: Person) => dispatch({ type: 'select', id: q.id })
  const work = [p.ro, p.co].filter(Boolean).join(' @ ')
  const lensOn = (mode: 'team' | 'era') => filters.cohort?.id === p.id && filters.cohort.mode === mode
  const toggleLens = (mode: 'team' | 'era') =>
    dispatch({ type: 'patchFilters', patch: { cohort: lensOn(mode) ? null : { id: p.id, mode } } })

  function copyLink() {
    navigator.clipboard?.writeText(location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <aside className="detail-panel" aria-label={`Profile: ${p.n}`}>
      <div className="detail-head">
        <button className="link-btn" onClick={copyLink}>{copied ? 'Link copied ✓' : 'Copy link'}</button>
        <button className="icon-btn" aria-label="Close profile" onClick={() => dispatch({ type: 'select', id: null })}>✕</button>
      </div>

      <div className="detail-identity">
        <div className="avatar" aria-hidden="true">{initials(p.n)}</div>
        <h2>{p.n}</h2>
        <div className="sport-tags">
          {p.sp.map(s => <span key={s} className="sport-tag">{ds.data.sports[s]}</span>)}
          {p.y != null && <span className="sport-tag year-tag">Class of '{String(p.y).slice(2)}</span>}
        </div>
        {work && <p className="detail-work">{work}</p>}
        {!work && p.hl && <p className="detail-work">{p.hl}</p>}
        <p className="detail-meta">
          {[p.in != null ? ds.data.industries[p.in] : null, p.lo ?? 'Location unknown'].filter(Boolean).join(' · ')}
        </p>
        <div className="detail-actions">
          {p.li && <a className="btn-primary" href={p.li} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
          <button className="btn-secondary" onClick={() => dispatch({ type: 'setFinder', open: true })}>
            Find connection
          </button>
        </div>
      </div>

      {(p.wh?.length || p.sk?.length || p.bi) && (
        <section className="detail-section">
          <h3>Career path</h3>
          {p.bi && <p className="detail-bio">{p.bi}</p>}
          {p.wh && (
            <ul className="work-list">
              {p.wh.map((w, i) => (
                <li key={i} className="work-row">
                  <span className="work-dot" aria-hidden="true" />
                  <span className="work-body">
                    <span className="work-title">{[w.t, w.c].filter(Boolean).join(' · ')}</span>
                    {(w.s || w.e !== undefined) && (
                      <span className="work-years">{w.s ?? '?'}–{w.e === null ? 'now' : w.e ?? '?'}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {p.sk && (
            <div className="skill-tags">
              {p.sk.map(s => <span key={s} className="skill-tag">{s}</span>)}
            </div>
          )}
        </section>
      )}

      {p.ad && (
        <section className="detail-section">
          <h3>Advice to students</h3>
          <blockquote className="advice">{p.ad}</blockquote>
        </section>
      )}

      {p.a != null && (
        <section className="detail-section">
          <h3>Their circle</h3>
          <p className="section-hint">
            On campus ~{p.a}–{p.b}. Put their circle on the map — your other filters stay on,
            so you can find their teammates in your city or industry.
          </p>
          <div className="lens-row">
            <button className={`chip ${lensOn('team') ? 'chip-active' : ''}`} onClick={() => toggleLens('team')}>
              {lensOn('team') ? '✓ ' : ''}Teammates on map ({mates.length.toLocaleString()})
            </button>
            <button className={`chip ${lensOn('era') ? 'chip-active' : ''}`} onClick={() => toggleLens('era')}>
              {lensOn('era') ? '✓ ' : ''}Whole era on map
            </button>
          </div>
          {mates.length > 0 && <TeamTimeline ego={p} mates={mates} onPick={pick} />}
        </section>
      )}

      {hasActiveFilters && (
        <section className="detail-section">
          <h3>Who can introduce me? <span className="count-pill">{intros.length}</span></h3>
          <p className="section-hint">Overlapped with {firstName(p.n)} at Cornell and match your current filters.</p>
          <PersonList
            ds={ds}
            people={intros.map(x => x.person)}
            onPick={pick}
            noteFor={q => {
              const via = intros.find(x => x.person.id === q.id)
              const base = [ds.data.sports[q.sp[0]], q.co].filter(Boolean).join(' · ')
              return via?.viaTeam ? `Teammate · ${base}` : base
            }}
          />
        </section>
      )}

      <section className="detail-section">
        <h3>Teammates <span className="count-pill">{mates.length.toLocaleString()}</span></h3>
        <p className="section-hint">Same sport, overlapping years — sorted by seasons together.</p>
        <PersonList
          ds={ds}
          people={mates}
          onPick={pick}
          noteFor={q => {
            const s = seasonsShared(p, q)
            const base = [q.co ?? ds.data.sports[q.sp[0]], q.lo].filter(Boolean).join(' · ')
            return `${s} season${s === 1 ? '' : 's'} together · ${base}`
          }}
        />
      </section>

      <section className="detail-section">
        <h3>On campus at the same time <span className="count-pill">{era.length.toLocaleString()}</span></h3>
        <p className="section-hint">Other sports, overlapping years.</p>
        <PersonList ds={ds} people={era} onPick={pick} />
      </section>

      {p.a == null && (
        <p className="muted">No class year on record — teammate matching isn't possible for this profile.</p>
      )}
    </aside>
  )
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function firstName(name: string): string {
  return name.split(/\s+/)[0]
}
