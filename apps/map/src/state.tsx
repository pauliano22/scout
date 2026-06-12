import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import type { ReactNode, Dispatch } from 'react'
import type { AppState, Filters, SortKey } from './types'
import { EMPTY_FILTERS } from './types'
import { paramsToState, stateToParams } from './url'

export type Action =
  | { type: 'patchFilters'; patch: Partial<Filters> }
  | { type: 'clearFilters' }
  | { type: 'select'; id: string | null }
  | { type: 'setView'; view: 'map' | 'list' }
  | { type: 'setUnmappedOnly'; on: boolean }
  | { type: 'sort'; key: SortKey }
  | { type: 'toggleSidebar' }
  | { type: 'hover'; index: number | null }
  | { type: 'setMySport'; sport: number | null }
  | { type: 'setFinder'; open: boolean }
  | { type: 'hydrate'; state: Partial<AppState> }

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'patchFilters':
      return { ...s, filters: { ...s.filters, ...a.patch } }
    case 'clearFilters':
      return { ...s, filters: { ...EMPTY_FILTERS }, unmappedOnly: false }
    case 'select':
      return { ...s, selectedId: a.id, finderOpen: a.id ? s.finderOpen : false }
    case 'setView':
      return { ...s, view: a.view, unmappedOnly: a.view === 'map' ? false : s.unmappedOnly }
    case 'setUnmappedOnly':
      return { ...s, unmappedOnly: a.on, view: a.on ? 'list' : s.view }
    case 'sort':
      return s.sortKey === a.key
        ? { ...s, sortDir: s.sortDir === 1 ? -1 : 1 }
        : { ...s, sortKey: a.key, sortDir: 1 }
    case 'toggleSidebar':
      return { ...s, sidebarOpen: !s.sidebarOpen }
    case 'hover':
      return s.hoveredIndex === a.index ? s : { ...s, hoveredIndex: a.index }
    case 'setMySport':
      localStorage.setItem('scout-map-my-sport', a.sport == null ? '' : String(a.sport))
      return { ...s, mySport: a.sport }
    case 'setFinder':
      return { ...s, finderOpen: a.open }
    case 'hydrate':
      return { ...s, ...a.state }
  }
}

function initialState(): AppState {
  const fromUrl = paramsToState(location.search)
  const mySportRaw = localStorage.getItem('scout-map-my-sport')
  return {
    filters: fromUrl.filters,
    selectedId: fromUrl.selectedId ?? null,
    view: fromUrl.view ?? 'map',
    unmappedOnly: fromUrl.unmappedOnly ?? false,
    sortKey: fromUrl.sortKey ?? 'relevance',
    sortDir: fromUrl.sortDir ?? 1,
    sidebarOpen: window.innerWidth > 900,
    hoveredIndex: null,
    mySport: mySportRaw ? Number(mySportRaw) : null,
    finderOpen: false,
  }
}

const StateCtx = createContext<AppState | null>(null)
const DispatchCtx = createContext<Dispatch<Action> | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  // URL sync, debounced so typing in search doesn't spam history
  const timer = useRef<number>()
  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const next = stateToParams(state)
      const cur = location.search || location.pathname
      if (next !== cur) history.replaceState(null, '', next)
    }, 250)
  }, [state.filters, state.selectedId, state.view, state.unmappedOnly, state.sortKey, state.sortDir])

  useEffect(() => {
    const onPop = () => dispatch({ type: 'hydrate', state: paramsToState(location.search) })
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  )
}

export function useAppState(): AppState {
  const s = useContext(StateCtx)
  if (!s) throw new Error('useAppState outside provider')
  return s
}

export function useAppDispatch(): Dispatch<Action> {
  const d = useContext(DispatchCtx)
  if (!d) throw new Error('useAppDispatch outside provider')
  return d
}
