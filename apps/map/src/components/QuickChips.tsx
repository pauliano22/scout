import { useState } from 'react'
import type { Dataset } from '../data'
import type { NearFilter } from '../types'
import { useAppDispatch, useAppState } from '../state'

const NEAR_PRESETS: Record<string, NearFilter> = {
  NYC: { label: 'NYC', lng: -74.006, lat: 40.7128, km: 60 },
  Boston: { label: 'Boston', lng: -71.0589, lat: 42.3601, km: 50 },
  'SF Bay': { label: 'SF Bay', lng: -122.4194, lat: 37.7749, km: 80 },
  Chicago: { label: 'Chicago', lng: -87.6298, lat: 41.8781, km: 50 },
  DC: { label: 'DC', lng: -77.0369, lat: 38.9072, km: 50 },
}

export default function QuickChips({ ds }: { ds: Dataset }) {
  const { filters, mySport } = useAppState()
  const dispatch = useAppDispatch()
  const [pickingSport, setPickingSport] = useState(false)
  const thisYear = new Date().getFullYear()

  const recentOn = filters.years?.[0] === thisYear - 5 && filters.years?.[1] === thisYear
  const financeIdx = ds.data.industries.indexOf('Finance')
  const techIdx = ds.data.industries.indexOf('Technology')

  function toggleNear(p: NearFilter) {
    const on = filters.near?.label === p.label
    dispatch({ type: 'patchFilters', patch: { near: on ? null : p } })
  }

  function toggleIndustry(i: number) {
    if (i < 0) return
    const on = filters.industries.includes(i)
    dispatch({ type: 'patchFilters', patch: { industries: on ? filters.industries.filter(x => x !== i) : [...filters.industries, i] } })
  }

  function toggleMySport() {
    if (mySport == null) { setPickingSport(true); return }
    const on = filters.sports.includes(mySport)
    dispatch({ type: 'patchFilters', patch: { sports: on ? filters.sports.filter(s => s !== mySport) : [...filters.sports, mySport] } })
  }

  return (
    <div className="chips" role="toolbar" aria-label="Quick filters">
      <button
        className={`chip ${mySport != null && filters.sports.includes(mySport) ? 'chip-active' : ''}`}
        onClick={toggleMySport}
        title={mySport != null ? `Your sport: ${ds.data.sports[mySport]} (right-click to change)` : 'Pick your sport'}
        onContextMenu={e => { e.preventDefault(); setPickingSport(true) }}
      >
        {mySport != null ? ds.data.sports[mySport] : 'My sport'}
      </button>
      {Object.entries(NEAR_PRESETS).slice(0, 3).map(([k, p]) => (
        <button key={k} className={`chip ${filters.near?.label === p.label ? 'chip-active' : ''}`} onClick={() => toggleNear(p)}>
          In {k}
        </button>
      ))}
      {financeIdx >= 0 && (
        <button className={`chip ${filters.industries.includes(financeIdx) ? 'chip-active' : ''}`} onClick={() => toggleIndustry(financeIdx)}>
          Finance
        </button>
      )}
      {techIdx >= 0 && (
        <button className={`chip ${filters.industries.includes(techIdx) ? 'chip-active' : ''}`} onClick={() => toggleIndustry(techIdx)}>
          Tech
        </button>
      )}
      <button
        className={`chip ${recentOn ? 'chip-active' : ''}`}
        onClick={() => dispatch({
          type: 'patchFilters',
          patch: { years: recentOn ? null : [thisYear - 5, thisYear] },
        })}
      >
        Last 5 years
      </button>

      {pickingSport && (
        <div className="sport-picker" role="dialog" aria-label="Pick your sport">
          <select
            autoFocus
            aria-label="Your sport"
            defaultValue=""
            onChange={e => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              dispatch({ type: 'setMySport', sport: v })
              if (v != null) dispatch({ type: 'patchFilters', patch: { sports: [...new Set([...filters.sports, v])] } })
              setPickingSport(false)
            }}
            onBlur={() => setPickingSport(false)}
          >
            <option value="" disabled>Pick your sport…</option>
            {ds.data.sports.map((s, i) => <option key={s} value={i}>{s}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
