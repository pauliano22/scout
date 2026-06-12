import { useEffect, useMemo, useState } from 'react'
import type { Dataset } from '../data'
import type { Person } from '../types'
import { findConnection } from '../overlap'
import { useAppDispatch, useAppState } from '../state'

function PersonPicker({ ds, label, value, onChange }: {
  ds: Dataset
  label: string
  value: Person | null
  onChange: (p: Person | null) => void
}) {
  const [q, setQ] = useState('')
  const results = useMemo(
    () => (q.trim().length >= 2 ? ds.fuse.search(q.trim(), { limit: 6 }).map(r => r.item) : []),
    [ds, q]
  )

  if (value) {
    return (
      <div className="picker-chosen">
        <span className="picker-label">{label}</span>
        <span className="picker-name">{value.n}{value.y ? ` '${String(value.y).slice(2)}` : ''}</span>
        <button className="link-btn" onClick={() => onChange(null)}>Change</button>
      </div>
    )
  }

  return (
    <div className="picker">
      <label>
        <span className="picker-label">{label}</span>
        <input
          type="search"
          placeholder="Type a name…"
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label={label}
        />
      </label>
      {results.length > 0 && (
        <ul className="picker-results">
          {results.map(p => (
            <li key={p.id}>
              <button onClick={() => { onChange(p); setQ('') }}>
                {p.n}{p.y ? ` '${String(p.y).slice(2)}` : ''}
                <span className="muted"> — {[ds.data.sports[p.sp[0]], p.co].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ConnectionFinder({ ds }: { ds: Dataset }) {
  const { selectedId } = useAppState()
  const dispatch = useAppDispatch()
  const [a, setA] = useState<Person | null>(selectedId ? ds.byId.get(selectedId) ?? null : null)
  const [b, setB] = useState<Person | null>(null)

  const result = useMemo(() => (a && b && a.id !== b.id ? findConnection(ds, a, b) : null), [ds, a, b])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dispatch({ type: 'setFinder', open: false }) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])

  return (
    <div className="finder-backdrop" onClick={e => { if (e.target === e.currentTarget) dispatch({ type: 'setFinder', open: false }) }}>
      <div className="finder" role="dialog" aria-modal="true" aria-label="Find a connection">
        <div className="finder-head">
          <h2>Find a connection</h2>
          <button className="icon-btn" aria-label="Close" onClick={() => dispatch({ type: 'setFinder', open: false })}>✕</button>
        </div>
        <p className="section-hint">Pick two people to see how they're linked through Cornell athletics.</p>

        <PersonPicker ds={ds} label="Person A" value={a} onChange={setA} />
        <PersonPicker ds={ds} label="Person B" value={b} onChange={setB} />

        {a && b && a.id === b.id && <p className="muted">Pick two different people.</p>}

        {result && a && b && (
          <div className="finder-result">
            {result.kind === 'teammates' && (
              <p className="finder-direct">
                <strong>Direct teammates.</strong> {a.n} and {b.n} played the same sport with overlapping years at Cornell.
              </p>
            )}
            {result.kind === 'same-era' && (
              <p className="finder-direct">
                <strong>On campus together.</strong> Different teams, but {a.n} and {b.n} overlapped at Cornell — a campus-era opener works here.
              </p>
            )}
            {result.kind === 'bridge' && (
              <>
                <p><strong>{result.bridges.length.toLocaleString()} bridge{result.bridges.length > 1 ? 's' : ''} found.</strong> These people were teammates with one of them and on campus with the other:</p>
                <ul className="bridge-list">
                  {result.bridges.slice(0, 15).map(c => (
                    <li key={c.id}>
                      <button className="person-row" onClick={() => { dispatch({ type: 'select', id: c.id }); dispatch({ type: 'setFinder', open: false }) }}>
                        <span className="person-row-name">{c.n}{c.y ? ` '${String(c.y).slice(2)}` : ''}</span>
                        <span className="person-row-meta">{[ds.data.sports[c.sp[0]], c.co].filter(Boolean).join(' · ')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {result.bridges.length > 15 && <p className="muted">+{result.bridges.length - 15} more</p>}
              </>
            )}
            {result.kind === 'none' && (
              <p className="muted">
                No direct overlap or shared teammate found. {a.a == null || b.a == null
                  ? 'One of them is missing a class year, which limits matching.'
                  : 'Their Cornell years are too far apart for a 2-hop path.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
