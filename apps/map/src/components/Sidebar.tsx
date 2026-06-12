import { useMemo, useState } from 'react'
import type { Dataset } from '../data'
import { useAppDispatch, useAppState } from '../state'
import { EMPTY_FILTERS } from '../types'

interface Props {
  ds: Dataset
  filtered: number[]
}

export default function Sidebar({ ds, filtered }: Props) {
  const { filters, sidebarOpen } = useAppState()
  const dispatch = useAppDispatch()
  const { sports, industries, stats } = ds.data
  const [sportQuery, setSportQuery] = useState('')

  const sportCounts = ds.sportCounts

  const visibleSports = useMemo(() => {
    const q = sportQuery.trim().toLowerCase()
    const idx = sports.map((_, i) => i)
    return q ? idx.filter(i => sports[i].toLowerCase().includes(q)) : idx
  }, [sports, sportQuery])

  const yearLo = filters.years?.[0] ?? stats.yearMin
  const yearHi = filters.years?.[1] ?? stats.yearMax

  const isDefault = JSON.stringify(filters) === JSON.stringify(EMPTY_FILTERS)

  function toggle(list: number[], v: number): number[] {
    return list.includes(v) ? list.filter(x => x !== v) : [...list, v]
  }

  if (!sidebarOpen) return null

  return (
    <aside className="sidebar" aria-label="Filters">
      <div className="sidebar-head">
        <h2>Filters</h2>
        {!isDefault && (
          <button className="link-btn" onClick={() => dispatch({ type: 'clearFilters' })}>Clear all</button>
        )}
      </div>

      <section className="filter-section">
        <h3>Class year</h3>
        <div className="decade-chips">
          {[1960, 1970, 1980, 1990, 2000, 2010, 2020].map(d => {
            const on = filters.years?.[0] === d && filters.years?.[1] === d + 9
            return (
              <button
                key={d}
                className={`chip chip-sm ${on ? 'chip-active' : ''}`}
                onClick={() => dispatch({ type: 'patchFilters', patch: { years: on ? null : [d, d + 9] } })}
              >
                '{String(d).slice(2)}s
              </button>
            )
          })}
        </div>
        <div className="year-labels">
          <span>{yearLo}</span><span>{yearHi}</span>
        </div>
        <div className="dual-range">
          <input
            type="range" min={stats.yearMin} max={stats.yearMax} value={yearLo}
            aria-label="Earliest class year"
            onChange={e => {
              const v = Math.min(Number(e.target.value), yearHi)
              dispatch({ type: 'patchFilters', patch: { years: [v, yearHi] } })
            }}
          />
          <input
            type="range" min={stats.yearMin} max={stats.yearMax} value={yearHi}
            aria-label="Latest class year"
            onChange={e => {
              const v = Math.max(Number(e.target.value), yearLo)
              dispatch({ type: 'patchFilters', patch: { years: [yearLo, v] } })
            }}
          />
        </div>
        {filters.years && (
          <button className="link-btn" onClick={() => dispatch({ type: 'patchFilters', patch: { years: null } })}>
            Any year
          </button>
        )}
      </section>

      <section className="filter-section">
        <h3>Industry</h3>
        <div className="check-list">
          {industries.map((ind, i) => (
            <label key={ind} className="check-row">
              <input
                type="checkbox"
                checked={filters.industries.includes(i)}
                onChange={() => dispatch({ type: 'patchFilters', patch: { industries: toggle(filters.industries, i) } })}
              />
              <span>{ind}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="filter-section">
        <h3>Sport</h3>
        <input
          className="text-filter"
          type="search"
          placeholder="Find a sport…"
          aria-label="Filter sports list"
          value={sportQuery}
          onChange={e => setSportQuery(e.target.value)}
        />
        <div className="check-list scroll">
          {visibleSports.map(i => (
            <label key={i} className="check-row">
              <input
                type="checkbox"
                checked={filters.sports.includes(i)}
                onChange={() => dispatch({ type: 'patchFilters', patch: { sports: toggle(filters.sports, i) } })}
              />
              <span>{sports[i]}</span>
              <span className="count">{sportCounts[i]}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="filter-section">
        <h3>Company</h3>
        <input
          className="text-filter"
          type="search"
          placeholder="e.g. Goldman, Google…"
          aria-label="Filter by company"
          value={filters.company}
          onChange={e => dispatch({ type: 'patchFilters', patch: { company: e.target.value } })}
        />
      </section>

      <section className="filter-section">
        <h3>Location</h3>
        <input
          className="text-filter"
          type="search"
          placeholder="City, state, or country…"
          aria-label="Filter by location"
          value={filters.loc}
          onChange={e => dispatch({ type: 'patchFilters', patch: { loc: e.target.value } })}
        />
        {filters.near && (
          <button className="chip chip-active" onClick={() => dispatch({ type: 'patchFilters', patch: { near: null } })}>
            Near {filters.near.label} ✕
          </button>
        )}
      </section>

      <div className="sidebar-foot">
        Showing <strong>{filtered.length.toLocaleString()}</strong> of {stats.total.toLocaleString()} alumni
      </div>
    </aside>
  )
}
