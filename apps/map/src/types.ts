export interface Person {
  id: string
  n: string            // full name
  sp: number[]         // sport indices
  y?: number           // class year
  a?: number           // campus window start
  b?: number           // campus window end
  co?: string          // company
  ro?: string          // role
  in?: number          // industry index
  lo?: string          // display location
  g?: [number, number] // [lng, lat]
  li?: string          // linkedin url
  hl?: string          // headline
  wh?: WorkEntry[]     // condensed work history
  sk?: string[]        // skills
  bi?: string          // bio
  ad?: string          // advice to students
  i: number            // array index, assigned at load
}

export interface WorkEntry {
  t?: string           // title
  c?: string           // company
  s?: number           // start year
  e?: number | null    // end year; null = present
}

export interface SportMeta {
  f: string
  g: 'm' | 'w' | null
}

export interface AlumniData {
  generatedAt: string
  stats: { total: number; geocoded: number; withYear: number; yearMin: number; yearMax: number }
  sports: string[]
  sportMeta: SportMeta[]
  industries: string[]
  alumni: Person[]
}

export interface NearFilter {
  label: string
  lng: number
  lat: number
  km: number
}

/** Lens that narrows the whole app to one person's circle. */
export interface CohortFilter {
  id: string
  mode: 'team' | 'era'   // teammates only, or everyone on campus with them
}

export interface Filters {
  q: string
  sports: number[]
  years: [number, number] | null
  industries: number[]
  company: string
  loc: string
  near: NearFilter | null
  cohort: CohortFilter | null
}

export const EMPTY_FILTERS: Filters = {
  q: '', sports: [], years: null, industries: [], company: '', loc: '', near: null, cohort: null,
}

export type SortKey = 'relevance' | 'name' | 'year' | 'sport' | 'company' | 'location'

export interface AppState {
  filters: Filters
  selectedId: string | null
  view: 'map' | 'list'
  unmappedOnly: boolean
  sortKey: SortKey
  sortDir: 1 | -1
  sidebarOpen: boolean
  hoveredIndex: number | null
  mySport: number | null
  finderOpen: boolean
}
