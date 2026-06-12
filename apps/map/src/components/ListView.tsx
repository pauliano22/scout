import { useEffect, useRef, useState } from 'react'
import type { Dataset } from '../data'
import type { SortKey } from '../types'
import { useAppDispatch, useAppState } from '../state'

const ROW_H = 52
const OVERSCAN = 8

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'year', label: 'Year' },
  { key: 'sport', label: 'Sport' },
  { key: 'company', label: 'Company' },
  { key: 'location', label: 'Location' },
]

interface Props {
  ds: Dataset
  sorted: number[]
}

export default function ListView({ ds, sorted }: Props) {
  const { sortKey, sortDir, unmappedOnly } = useAppState()
  const dispatch = useAppDispatch()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState<[number, number]>([0, 40])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      const start = Math.max(0, Math.floor(el.scrollTop / ROW_H) - OVERSCAN)
      const end = Math.min(sorted.length, Math.ceil((el.scrollTop + el.clientHeight) / ROW_H) + OVERSCAN)
      setRange(([s, e]) => (s === start && e === end ? [s, e] : [start, end]))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', update); ro.disconnect() }
  }, [sorted.length])

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [sortKey, sortDir, sorted.length])

  if (!sorted.length) {
    return (
      <div className="list-empty">
        <p>No alumni match these filters.</p>
        <button className="btn-secondary" onClick={() => dispatch({ type: 'clearFilters' })}>Clear filters</button>
      </div>
    )
  }

  return (
    <div className="list-view">
      {unmappedOnly && (
        <div className="list-banner">
          Showing alumni without a mappable location.
          <button className="link-btn" onClick={() => dispatch({ type: 'setUnmappedOnly', on: false })}>Show everyone</button>
        </div>
      )}
      <div className="list-header" role="row">
        {COLUMNS.map(c => (
          <button
            key={c.key}
            className={`list-col col-${c.key} ${sortKey === c.key ? 'sorted' : ''}`}
            onClick={() => dispatch({ type: 'sort', key: c.key })}
            aria-sort={sortKey === c.key ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}
          >
            {c.label}{sortKey === c.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
          </button>
        ))}
      </div>
      <div className="list-scroll" ref={scrollRef}>
        <div style={{ height: sorted.length * ROW_H, position: 'relative' }}>
          {sorted.slice(range[0], range[1]).map((idx, k) => {
            const p = ds.data.alumni[idx]
            const row = range[0] + k
            return (
              <button
                key={p.id}
                className="list-row"
                style={{ top: row * ROW_H, height: ROW_H }}
                onClick={() => dispatch({ type: 'select', id: p.id })}
                onMouseEnter={() => dispatch({ type: 'hover', index: p.g ? idx : null })}
                onMouseLeave={() => dispatch({ type: 'hover', index: null })}
              >
                <span className="list-col col-name">
                  {p.n}
                  {!p.g && <span className="badge-unmapped" title="Not shown on map">off-map</span>}
                </span>
                <span className="list-col col-year">{p.y ?? '—'}</span>
                <span className="list-col col-sport">{p.sp.map(s => ds.data.sports[s]).join(', ')}</span>
                <span className="list-col col-company">
                  {p.co ?? '—'}
                  {p.ro && <span className="col-role">{p.ro}</span>}
                </span>
                <span className="list-col col-location">{p.lo ?? '—'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
