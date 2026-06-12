import type { Dataset } from './data'
import type { Filters, Person, SortKey } from './types'
import { cohortSet } from './overlap'

export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = (b[1] - a[1]) * Math.PI / 180
  const dLng = (b[0] - a[0]) * Math.PI / 180
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Returns matching person indices; ordered by search relevance when `q` is set. */
export function applyFilters(ds: Dataset, f: Filters): number[] {
  const base: Person[] = f.q.trim().length >= 2
    ? ds.fuse.search(f.q.trim()).map(r => r.item)
    : ds.data.alumni

  const co = f.company.trim().toLowerCase()
  const lo = f.loc.trim().toLowerCase()
  const sports = f.sports.length ? new Set(f.sports) : null
  const industries = f.industries.length ? new Set(f.industries) : null
  const cohortEgo = f.cohort ? ds.byId.get(f.cohort.id) : undefined
  const cohort = cohortEgo && f.cohort ? cohortSet(ds, cohortEgo, f.cohort.mode) : null

  const out: number[] = []
  for (const p of base) {
    if (cohort && !cohort.has(p.i)) continue
    if (sports && !p.sp.some(s => sports.has(s))) continue
    if (f.years && (p.y == null || p.y < f.years[0] || p.y > f.years[1])) continue
    if (industries && (p.in == null || !industries.has(p.in))) continue
    if (co && !(p.co ?? '').toLowerCase().includes(co)) continue
    if (lo && !(p.lo ?? '').toLowerCase().includes(lo)) continue
    if (f.near && (!p.g || haversineKm(p.g, [f.near.lng, f.near.lat]) > f.near.km)) continue
    out.push(p.i)
  }
  return out
}

export function sortIndices(ds: Dataset, indices: number[], key: SortKey, dir: 1 | -1): number[] {
  if (key === 'relevance') return indices
  const a = ds.data.alumni
  const cmp: Record<Exclude<SortKey, 'relevance'>, (x: Person, y: Person) => number> = {
    name: (x, y) => x.n.localeCompare(y.n),
    year: (x, y) => (x.y ?? 0) - (y.y ?? 0),
    sport: (x, y) => (ds.data.sports[x.sp[0]] ?? '').localeCompare(ds.data.sports[y.sp[0]] ?? ''),
    company: (x, y) => (x.co ?? '￿').localeCompare(y.co ?? '￿'),
    location: (x, y) => (x.lo ?? '￿').localeCompare(y.lo ?? '￿'),
  }
  return [...indices].sort((i, j) => dir * cmp[key](a[i], a[j]))
}
