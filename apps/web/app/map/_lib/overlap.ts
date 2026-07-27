import type { Dataset } from './data'
import type { Person, SavedContact } from './types'

export function yearsOverlap(p: Person, q: Person): boolean {
  return p.a != null && q.a != null && Math.max(p.a, q.a!) < Math.min(p.b!, q.b!)
}

/** Academic years both were on campus (0 when no overlap). */
export function seasonsShared(p: Person, q: Person): number {
  if (p.a == null || q.a == null) return 0
  return Math.max(0, Math.min(p.b!, q.b!) - Math.max(p.a, q.a!))
}

/** Same sport (family-aware) + overlapping campus years. */
export function teammates(ds: Dataset, p: Person): Person[] {
  if (p.a == null) return []
  const seen = new Set<number>()
  const out: Person[] = []
  for (const s of p.sp) {
    for (const cs of ds.compatibleSports[s]) {
      for (const i of ds.sportBuckets[cs]) {
        if (i === p.i || seen.has(i)) continue
        const q = ds.data.alumni[i]
        if (yearsOverlap(p, q)) { seen.add(i); out.push(q) }
      }
    }
  }
  return out.sort(byYearThenName)
}

/** On campus at the same time, different team. Capped — campuses are big. */
export function sameEra(ds: Dataset, p: Person, cap = 4000): Person[] {
  if (p.a == null) return []
  const mates = new Set(teammates(ds, p).map(t => t.i))
  const out: Person[] = []
  for (const q of ds.data.alumni) {
    if (q.i === p.i || mates.has(q.i)) continue
    if (yearsOverlap(p, q)) {
      out.push(q)
      if (out.length >= cap) break
    }
  }
  return out.sort(byYearThenName)
}

export interface WarmPath {
  contact: Person
  status: string | null
  teammate: boolean
  seasons: number
}

/**
 * Warm intro routes to `p`: the viewer's saved contacts who overlapped with
 * them on campus — teammates first, then by seasons shared.
 */
export function warmFor(ds: Dataset, p: Person, saved: SavedContact[]): WarmPath[] {
  if (!saved.length) return []
  const mateIds = new Set(teammates(ds, p).map(m => m.id))
  return saved
    .filter(s => s.alumniId !== p.id)
    .flatMap(s => {
      const c = ds.byId.get(s.alumniId)
      if (!c || !yearsOverlap(p, c)) return []
      return [{ contact: c, status: s.status, teammate: mateIds.has(c.id), seasons: seasonsShared(p, c) }]
    })
    .sort((a, b) => Number(b.teammate) - Number(a.teammate) || b.seasons - a.seasons)
}

function byYearThenName(a: Person, b: Person): number {
  return (b.y ?? 0) - (a.y ?? 0) || a.n.localeCompare(b.n)
}
