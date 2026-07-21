// Server-side "Cornell circle" engine: who was on campus with whom, and for
// how many seasons. Reads the pre-baked alumni-map dataset (written by
// apps/map/scripts/build-data.mjs into apps/web/data/alumni-map.json), whose
// ids are real alumni-table ids — so results join cleanly with user_networks.
//
// Campus windows: education start/end when trustworthy, else class year − 4.
// Two people overlap when max(start) < min(end) — touching edges (May grad vs
// August arrival) deliberately do NOT count.

import { readFile } from 'fs/promises'
import path from 'path'

interface RawPerson {
  id: string
  n: string
  sp: number[]
  y?: number
  a?: number
  b?: number
  co?: string
  ro?: string
  in?: number
  lo?: string
  av?: string
}

interface RawData {
  sports: string[]
  sportMeta: { f: string; g: 'm' | 'w' | null }[]
  industries: string[]
  alumni: RawPerson[]
}

interface CircleDataset {
  raw: RawData
  byId: Map<string, RawPerson>
  buckets: number[][]          // sport index -> alumni array positions
  compatible: number[][]       // sport index -> overlapping sport indices (family/gender aware)
  pos: Map<string, number>     // id -> alumni array position
}

let loading: Promise<CircleDataset> | null = null

export function getCircleDataset(): Promise<CircleDataset> {
  loading ??= load()
  return loading
}

async function load(): Promise<CircleDataset> {
  const file = path.join(process.cwd(), 'data', 'alumni-map.json')
  const raw = JSON.parse(await readFile(file, 'utf8')) as RawData

  const byId = new Map<string, RawPerson>()
  const pos = new Map<string, number>()
  raw.alumni.forEach((p, i) => { byId.set(p.id, p); pos.set(p.id, i) })

  const buckets: number[][] = raw.sports.map(() => [])
  raw.alumni.forEach((p, i) => { for (const s of p.sp) buckets[s].push(i) })

  // Generic ungendered rosters (plain "Rowing") overlap both gendered teams.
  const compatible = raw.sportMeta.map(a =>
    raw.sportMeta
      .map((b, j) => ({ b, j }))
      .filter(({ b }) => a.f === b.f && (a.g === b.g || a.g === null || b.g === null))
      .map(({ j }) => j)
  )

  return { raw, byId, buckets, compatible, pos }
}

function overlaps(p: RawPerson, q: RawPerson): boolean {
  return p.a != null && q.a != null && Math.max(p.a, q.a) < Math.min(p.b!, q.b!)
}

export function seasonsShared(p: RawPerson, q: RawPerson): number {
  if (p.a == null || q.a == null) return 0
  return Math.max(0, Math.min(p.b!, q.b!) - Math.max(p.a, q.a))
}

function sharesTeam(ds: CircleDataset, p: RawPerson, q: RawPerson): boolean {
  return p.sp.some(s => ds.compatible[s].some(cs => q.sp.includes(cs)))
}

function teammatesOf(ds: CircleDataset, p: RawPerson): RawPerson[] {
  if (p.a == null) return []
  const seen = new Set<number>()
  const out: RawPerson[] = []
  const self = ds.pos.get(p.id)
  for (const s of p.sp) {
    for (const cs of ds.compatible[s]) {
      for (const i of ds.buckets[cs]) {
        if (i === self || seen.has(i)) continue
        const q = ds.raw.alumni[i]
        if (overlaps(p, q)) { seen.add(i); out.push(q) }
      }
    }
  }
  return out.sort((x, y) => seasonsShared(p, y) - seasonsShared(p, x) || (y.y ?? 0) - (x.y ?? 0))
}

export interface CirclePersonSummary {
  id: string
  name: string
  gradYear: number | null
  sports: string[]
  seasons: number
  company: string | null
  role: string | null
  location: string | null
  avatar: string | null
  onScout: boolean
}

export interface CircleOptions {
  /**
   * Live ids to drop entirely. The dataset is a static bake, so rows that have
   * since opted out (is_public=false) or been merged away (is_duplicate) must
   * be filtered at read time or the bake shows people who withdrew consent.
   */
  exclude?: Set<string>
  /** Live ids of claimed members: lifted above the teammate slice and flagged onScout. */
  prioritize?: Set<string>
}

export interface WarmPath {
  alumniId: string
  name: string
  gradYear: number | null
  sports: string[]
  relation: 'teammate' | 'same_era'
  seasons: number
  status: string | null
}

export interface Circle {
  person: {
    id: string
    name: string
    gradYear: number | null
    sports: string[]
    campusStart: number | null
    campusEnd: number | null
  }
  teammatesCount: number
  eraCount: number
  teammates: CirclePersonSummary[]
  warmPaths: WarmPath[]
}

function summarize(ds: CircleDataset, ego: RawPerson, q: RawPerson, onScout = false): CirclePersonSummary {
  return {
    id: q.id,
    name: q.n,
    gradYear: q.y ?? null,
    sports: q.sp.map(s => ds.raw.sports[s]),
    seasons: seasonsShared(ego, q),
    company: q.co ?? null,
    role: q.ro ?? null,
    location: q.lo ?? null,
    avatar: q.av ?? null,
    onScout,
  }
}

export interface WarmPathSummaryOut {
  count: number
  topName: string
  topRelation: 'teammate' | 'same_era'
  /** seasons the top introducer overlapped with the candidate (0 when unknown) */
  topSeasons: number
  /** the top introducer's sports (family names) */
  topSports: string[]
}

/**
 * Rank a warm-path introducer. A real teammate always beats a mere era-overlap,
 * then more shared seasons, then recency — recent grads are the warm bridges to
 * older alumni and respond far more often, so they get lifted within a tier.
 */
export function warmScore(relation: 'teammate' | 'same_era', seasons: number, gradYear: number | null): number {
  const rel = relation === 'teammate' ? 100 : 0
  const seasonPts = Math.min(Math.max(seasons, 0), 6) * 4
  // Current year computed per call, not at module load — a long-lived server
  // process crossing a year boundary would otherwise misscore recency.
  const age = gradYear == null ? 40 : Math.max(0, new Date().getFullYear() - gradYear)
  const recency = age <= 3 ? 12 : age <= 6 ? 8 : age <= 12 ? 3 : 0
  return rel + seasonPts + recency
}

/**
 * Batch warm-path lookup for recommendation surfaces: for each candidate id,
 * is anyone in the caller's saved network a campus overlap? O(ids × saved) —
 * a 30-card deck against a 50-person network is 1,500 window comparisons.
 */
export async function warmPathsFor(
  alumniIds: string[],
  saved: { alumniId: string; status: string | null }[]
): Promise<Record<string, WarmPathSummaryOut>> {
  const ds = await getCircleDataset()
  const contacts = saved
    .map(s => ds.byId.get(s.alumniId))
    .filter((p): p is RawPerson => !!p)
  const out: Record<string, WarmPathSummaryOut> = {}
  if (!contacts.length) return out

  for (const id of alumniIds) {
    const ego = ds.byId.get(id)
    if (!ego || ego.a == null) continue
    let count = 0
    let top: { name: string; relation: 'teammate' | 'same_era'; seasons: number; sports: string[]; score: number } | null = null
    for (const c of contacts) {
      if (c.id === id || !overlaps(ego, c)) continue
      count++
      const relation: 'teammate' | 'same_era' = sharesTeam(ds, ego, c) ? 'teammate' : 'same_era'
      const seasons = seasonsShared(ego, c)
      const score = warmScore(relation, seasons, c.y ?? null)
      if (!top || score > top.score) {
        top = { name: c.n, relation, seasons, sports: c.sp.map(x => ds.raw.sports[x]), score }
      }
    }
    if (count > 0 && top) {
      out[id] = { count, topName: top.name, topRelation: top.relation, topSeasons: top.seasons, topSports: top.sports }
    }
  }
  return out
}

/**
 * The full circle for one alum, plus warm paths through the caller's saved
 * network: saved contacts who were on campus with the target.
 */
export async function buildCircle(
  alumniId: string,
  saved: { alumniId: string; status: string | null }[],
  teammateLimit = 12,
  opts: CircleOptions = {}
): Promise<Circle | null> {
  const ds = await getCircleDataset()
  const ego = ds.byId.get(alumniId)
  if (!ego) return null

  const excluded = opts.exclude
  const claimed = opts.prioritize

  let mates = teammatesOf(ds, ego)
  if (excluded?.size) mates = mates.filter(m => !excluded.has(m.id))
  const mateIds = new Set(mates.map(m => m.id))

  // Claimed teammates surface above the slice: with few members, a
  // seasons-only top-N would essentially never show anyone actually on Scout.
  // Order within each group stays seasons-based.
  if (claimed?.size) {
    mates = [...mates.filter(m => claimed.has(m.id)), ...mates.filter(m => !claimed.has(m.id))]
  }

  let eraCount = 0
  if (ego.a != null) {
    for (const q of ds.raw.alumni) {
      if (q.id !== ego.id && !excluded?.has(q.id) && overlaps(ego, q)) eraCount++
    }
  }

  const warmPaths: WarmPath[] = []
  for (const s of saved) {
    if (s.alumniId === alumniId || excluded?.has(s.alumniId)) continue
    const contact = ds.byId.get(s.alumniId)
    if (!contact || !overlaps(ego, contact)) continue
    warmPaths.push({
      alumniId: contact.id,
      name: contact.n,
      gradYear: contact.y ?? null,
      sports: contact.sp.map(x => ds.raw.sports[x]),
      relation: mateIds.has(contact.id) || sharesTeam(ds, ego, contact) ? 'teammate' : 'same_era',
      seasons: seasonsShared(ego, contact),
      status: s.status,
    })
  }
  warmPaths.sort((a, b) =>
    warmScore(b.relation, b.seasons, b.gradYear) - warmScore(a.relation, a.seasons, a.gradYear)
  )

  return {
    person: {
      id: ego.id,
      name: ego.n,
      gradYear: ego.y ?? null,
      sports: ego.sp.map(s => ds.raw.sports[s]),
      campusStart: ego.a ?? null,
      campusEnd: ego.b ?? null,
    },
    teammatesCount: mates.length,
    eraCount: eraCount - mates.length,
    teammates: mates.slice(0, teammateLimit).map(m => summarize(ds, ego, m, claimed?.has(m.id) ?? false)),
    warmPaths: warmPaths.slice(0, 10),
  }
}
