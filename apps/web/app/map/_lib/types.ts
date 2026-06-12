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
  g?: [number, number] // [lng, lat] (unused by Circles; present in the dataset)
  li?: string          // linkedin url
  av?: string          // photo url
  hl?: string          // headline
  wh?: WorkEntry[]     // condensed work history
  sk?: string[]        // skills
  i: number            // array index, assigned at load
}

export interface WorkEntry {
  t?: string
  c?: string
  s?: number
  e?: number | null
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

export interface SavedContact {
  alumniId: string
  status: string | null
}
