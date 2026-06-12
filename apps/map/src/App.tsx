import { useMemo } from 'react'
import type { Dataset } from './data'
import { applyFilters, sortIndices } from './filtering'
import { useAppDispatch, useAppState } from './state'
import { EMPTY_FILTERS } from './types'
import MapView from './components/MapView'
import ListView from './components/ListView'
import Sidebar from './components/Sidebar'
import SearchBox from './components/SearchBox'
import QuickChips from './components/QuickChips'
import DetailPanel from './components/DetailPanel'
import WelcomePanel from './components/WelcomePanel'
import FilterPills from './components/FilterPills'
import ConnectionFinder from './components/ConnectionFinder'

export default function App({ ds }: { ds: Dataset }) {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { filters, view, unmappedOnly, sortKey, sortDir, selectedId, finderOpen, sidebarOpen } = state

  const filtered = useMemo(() => applyFilters(ds, filters), [ds, filters])
  const filteredSet = useMemo(() => new Set(filtered), [filtered])
  const unmapped = useMemo(() => filtered.filter(i => !ds.data.alumni[i].g), [ds, filtered])

  const listIndices = useMemo(() => {
    const base = unmappedOnly ? unmapped : filtered
    return sortIndices(ds, base, sortKey, sortDir)
  }, [ds, filtered, unmapped, unmappedOnly, sortKey, sortDir])

  const hasActiveFilters = useMemo(
    () => JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS),
    [filters]
  )

  return (
    <div className={`app ${selectedId ? 'has-detail' : ''}`}>
      <header className="topbar">
        <button
          className="icon-btn sidebar-toggle"
          aria-label={sidebarOpen ? 'Hide filters' : 'Show filters'}
          aria-expanded={sidebarOpen}
          onClick={() => dispatch({ type: 'toggleSidebar' })}
        >
          ☰
        </button>
        <h1 className="brand"><span className="brand-mark">Scout</span> Alumni Map</h1>
        <SearchBox ds={ds} />
        <div className="view-toggle" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'on' : ''} onClick={() => dispatch({ type: 'setView', view: 'map' })}>Map</button>
          <button role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => dispatch({ type: 'setView', view: 'list' })}>List</button>
        </div>
      </header>

      <QuickChips ds={ds} />

      <div className="body">
        <Sidebar ds={ds} filtered={filtered} />

        <main className="main">
          <div className="result-bar" aria-live="polite">
            <span className="result-count">
              Showing <strong>{(unmappedOnly ? unmapped.length : filtered.length).toLocaleString()}</strong> of {ds.data.stats.total.toLocaleString()} alumni
            </span>
            <FilterPills ds={ds} />
            {view === 'map' && unmapped.length > 0 && (
              <button className="link-btn off-map-link" onClick={() => dispatch({ type: 'setUnmappedOnly', on: true })}>
                {unmapped.length.toLocaleString()} not on map →
              </button>
            )}
          </div>
          {view === 'map'
            ? <MapView ds={ds} filtered={filtered} />
            : <ListView ds={ds} sorted={listIndices} />}
        </main>

        {selectedId
          ? <DetailPanel ds={ds} filteredSet={filteredSet} hasActiveFilters={hasActiveFilters} />
          : <WelcomePanel ds={ds} />}
      </div>

      {finderOpen && <ConnectionFinder ds={ds} />}
    </div>
  )
}
