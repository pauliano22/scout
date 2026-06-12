import Fuse from 'fuse.js'
import type { AlumniData, Person } from './types'

export interface Dataset {
  data: AlumniData
  fuse: Fuse<Person>
  byId: Map<string, Person>
  sportCounts: number[]         // sport index -> member count
  sportBuckets: number[][]      // sport index -> person indices
  compatibleSports: number[][]  // sport index -> sport indices that count as "same team"
}

let dataset: Dataset | null = null

export async function loadDataset(): Promise<Dataset> {
  if (dataset) return dataset
  const mod = await import('../data/alumni.json')
  const data = mod.default as unknown as AlumniData
  data.alumni.forEach((p, i) => { p.i = i })

  const fuse = new Fuse(data.alumni, {
    keys: [
      { name: 'n', weight: 0.8 },
      { name: 'co', weight: 0.2 },
    ],
    threshold: 0.32,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })

  const sportBuckets: number[][] = data.sports.map(() => [])
  for (const p of data.alumni) for (const s of p.sp) sportBuckets[s].push(p.i)

  // Sports overlap when families match and genders are equal or either is unknown
  // (lets the generic "Rowing" roster overlap both gendered rowing teams).
  const compatibleSports = data.sportMeta.map((a, i) =>
    data.sportMeta
      .map((b, j) => ({ b, j }))
      .filter(({ b }) => a.f === b.f && (a.g === b.g || a.g === null || b.g === null))
      .map(({ j }) => j)
  )

  const byId = new Map(data.alumni.map(p => [p.id, p]))
  const sportCounts = sportBuckets.map(b => b.length)

  dataset = { data, fuse, byId, sportCounts, sportBuckets, compatibleSports }
  return dataset
}
