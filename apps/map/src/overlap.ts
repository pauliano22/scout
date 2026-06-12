import type { Dataset } from './data'
import type { Person } from './types'

export function yearsOverlap(p: Person, q: Person): boolean {
  return p.a != null && q.a != null && Math.max(p.a, q.a!) < Math.min(p.b!, q.b!)
}

/** Academic years both were on campus (0 when no overlap). */
export function seasonsShared(p: Person, q: Person): number {
  if (p.a == null || q.a == null) return 0
  return Math.max(0, Math.min(p.b!, q.b!) - Math.max(p.a, q.a!))
}

/**
 * Person indices for a cohort lens: the person's teammates ('team') or
 * everyone on campus with them ('era'). Includes the person themself so
 * their pin stays visible while the lens is on.
 */
export function cohortSet(ds: Dataset, ego: Person, mode: 'team' | 'era'): Set<number> {
  const set = new Set<number>([ego.i])
  if (ego.a == null) return set
  if (mode === 'team') {
    for (const t of teammates(ds, ego)) set.add(t.i)
  } else {
    for (const q of ds.data.alumni) if (yearsOverlap(ego, q)) set.add(q.i)
  }
  return set
}

function sharesTeam(ds: Dataset, p: Person, q: Person): boolean {
  return p.sp.some(s => ds.compatibleSports[s].some(cs => q.sp.includes(cs)))
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

export interface ConnectionPath {
  kind: 'teammates' | 'same-era' | 'bridge' | 'none'
  bridges: Person[]
}

/**
 * Direct teammate / same-era link, else a 2-hop bridge: someone who was a
 * teammate of one person and at least on campus with the other.
 */
export function findConnection(ds: Dataset, a: Person, b: Person): ConnectionPath {
  if (yearsOverlap(a, b)) {
    return { kind: sharesTeam(ds, a, b) ? 'teammates' : 'same-era', bridges: [] }
  }
  const aMates = teammates(ds, a)
  const bMates = teammates(ds, b)
  const aSet = new Set(aMates.map(t => t.i))
  const bSet = new Set(bMates.map(t => t.i))
  const seen = new Set<number>()
  const bridges: Person[] = []
  for (const c of [...aMates, ...bMates]) {
    if (seen.has(c.i)) continue
    seen.add(c.i)
    const teamA = aSet.has(c.i)
    const teamB = bSet.has(c.i)
    if ((teamA && (teamB || yearsOverlap(c, b))) || (teamB && yearsOverlap(c, a))) bridges.push(c)
  }
  bridges.sort(byYearThenName)
  return bridges.length ? { kind: 'bridge', bridges } : { kind: 'none', bridges: [] }
}

/** Warm-intro candidates: people who overlapped with `p` and pass the active filters. */
export function introCandidates(ds: Dataset, p: Person, filteredSet: Set<number>, cap = 40): { person: Person; viaTeam: boolean }[] {
  if (p.a == null) return []
  const mates = new Set(teammates(ds, p).map(t => t.i))
  const out: { person: Person; viaTeam: boolean }[] = []
  for (const i of mates) {
    if (filteredSet.has(i) && i !== p.i) out.push({ person: ds.data.alumni[i], viaTeam: true })
  }
  if (out.length < cap) {
    for (const q of ds.data.alumni) {
      if (out.length >= cap) break
      if (q.i === p.i || mates.has(q.i) || !filteredSet.has(q.i)) continue
      if (yearsOverlap(p, q)) out.push({ person: q, viaTeam: false })
    }
  }
  return out
    .sort((x, y) => Number(y.viaTeam) - Number(x.viaTeam) || byYearThenName(x.person, y.person))
    .slice(0, cap)
}

function byYearThenName(a: Person, b: Person): number {
  return (b.y ?? 0) - (a.y ?? 0) || a.n.localeCompare(b.n)
}
