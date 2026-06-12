import type { AppState, Filters } from './types'
import { EMPTY_FILTERS } from './types'

export function stateToParams(s: AppState): string {
  const p = new URLSearchParams()
  const f = s.filters
  if (f.q) p.set('q', f.q)
  if (f.sports.length) p.set('sp', f.sports.join(','))
  if (f.years) p.set('y', `${f.years[0]}-${f.years[1]}`)
  if (f.industries.length) p.set('in', f.industries.join(','))
  if (f.company) p.set('co', f.company)
  if (f.loc) p.set('loc', f.loc)
  if (f.near) p.set('near', `${f.near.lng},${f.near.lat},${f.near.km},${f.near.label}`)
  if (f.cohort) p.set('coh', `${f.cohort.mode}:${f.cohort.id}`)
  if (s.selectedId) p.set('sel', s.selectedId)
  if (s.view !== 'map') p.set('view', s.view)
  if (s.unmappedOnly) p.set('um', '1')
  if (s.sortKey !== 'relevance') { p.set('sort', s.sortKey); if (s.sortDir === -1) p.set('dir', 'desc') }
  const str = p.toString()
  return str ? `?${str}` : location.pathname
}

export function paramsToState(search: string): Partial<AppState> & { filters: Filters } {
  const p = new URLSearchParams(search)
  const filters: Filters = { ...EMPTY_FILTERS }
  filters.q = p.get('q') ?? ''
  filters.sports = csvInts(p.get('sp'))
  filters.industries = csvInts(p.get('in'))
  filters.company = p.get('co') ?? ''
  filters.loc = p.get('loc') ?? ''
  const y = p.get('y')?.match(/^(\d{4})-(\d{4})$/)
  if (y) filters.years = [Number(y[1]), Number(y[2])]
  const near = p.get('near')?.split(',')
  if (near && near.length >= 4) {
    const [lng, lat, km] = near.map(Number)
    if ([lng, lat, km].every(Number.isFinite)) {
      filters.near = { lng, lat, km, label: near.slice(3).join(',') }
    }
  }
  const coh = p.get('coh')?.match(/^(team|era):(.+)$/)
  if (coh) filters.cohort = { mode: coh[1] as 'team' | 'era', id: coh[2] }
  const view = p.get('view')
  const sort = p.get('sort')
  return {
    filters,
    selectedId: p.get('sel'),
    view: view === 'list' ? 'list' : 'map',
    unmappedOnly: p.get('um') === '1',
    sortKey: sort === 'name' || sort === 'year' || sort === 'sport' || sort === 'company' || sort === 'location' ? sort : 'relevance',
    sortDir: p.get('dir') === 'desc' ? -1 : 1,
  }
}

function csvInts(v: string | null): number[] {
  if (!v) return []
  return v.split(',').map(Number).filter(n => Number.isInteger(n) && n >= 0)
}
