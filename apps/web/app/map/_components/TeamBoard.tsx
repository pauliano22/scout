import { useMemo, useState } from 'react'
import type { Dataset } from '../_lib/data'
import type { Person, SavedContact } from '../_lib/types'
import { initials, nowLine, shortYear } from '../_lib/now'

interface Props {
  ds: Dataset
  sportIndices: number[]
  saved: SavedContact[]
  onSave: (alumniId: string) => void
  onPick: (p: Person) => void
}

const COLUMNS = 4
const CARDS_PER_COLUMN = 6
const CHIPS_SHOWN = 7

export default function TeamBoard({ ds, sportIndices, saved, onSave, onPick }: Props) {
  const [openColumns, setOpenColumns] = useState<Set<number>>(new Set())
  const [chipsOpen, setChipsOpen] = useState({ industries: false, cities: false })

  const board = useMemo(() => {
    // sportIndices is already the family/gender-compatible set — expanding it
    // through compatibleSports again would leak the other gender's roster in
    // via the generic (ungendered) entry.
    const seen = new Set<number>()
    const people: Person[] = []
    for (const s of sportIndices) {
      for (const i of ds.sportBuckets[s]) {
        if (!seen.has(i)) { seen.add(i); people.push(ds.data.alumni[i]) }
      }
    }

    const byIndustry = new Map<number, Person[]>()
    for (const p of people) {
      if (p.in == null || (!p.ro && !p.co)) continue
      if (!byIndustry.has(p.in)) byIndustry.set(p.in, [])
      byIndustry.get(p.in)!.push(p)
    }
    const ranked = [...byIndustry.entries()].sort(([, a], [, b]) => b.length - a.length)
    const columns = ranked.slice(0, COLUMNS).map(([ind, members]) => ({
      industry: ds.data.industries[ind],
      people: members.sort((p, q) => (q.y ?? 0) - (p.y ?? 0) || (q.av ? 1 : 0) - (p.av ? 1 : 0)),
    }))
    const restIndustries = ranked.slice(COLUMNS).map(([ind, members]) => [ds.data.industries[ind], members.length] as const)

    // "New York, New York" → "New York"; aggregate on the short name.
    const cityCounts = new Map<string, number>()
    for (const p of people) {
      if (!p.lo) continue
      const city = p.lo.split(',')[0].trim()
      if (city) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1)
    }
    const cities = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])

    const withNow = people.filter(p => p.ro || p.co).length
    return { total: people.length, withNow, columns, restIndustries, cities }
  }, [ds, sportIndices])

  if (board.columns.length === 0) return null

  const savedIds = new Set(saved.map(s => s.alumniId))
  const sportLabel = ds.data.sportMeta[sportIndices[0]]?.f ?? ds.data.sports[sportIndices[0]] ?? 'team'

  const chipRow = (items: readonly (readonly [string, number])[], open: boolean, toggle: () => void, className: string) => {
    const shown = open ? items : items.slice(0, CHIPS_SHOWN)
    return (
      <div className={`bd-chips ${className}`}>
        {shown.map(([name, count]) => (
          <span className="bd-chip" key={name}>{name}<small>{count}</small></span>
        ))}
        {items.length > CHIPS_SHOWN && (
          <button className="bd-chip bd-more" aria-expanded={open} onClick={toggle}>
            {open ? 'Show fewer' : `+${items.length - CHIPS_SHOWN} more`}
          </button>
        )}
      </div>
    )
  }

  return (
    <section aria-label="Where your team went">
      <div className="ld-head">
        <p className="ld-eyebrow">Cornell {sportLabel}</p>
        <h2>Where your team went</h2>
        <p className="ld-sub">{board.total.toLocaleString()} {sportLabel} alumni came before you.</p>
      </div>

      <p className="bd-note">Newest first — they reply.</p>
      <div className="bd-board">
        {board.columns.map((col, ci) => {
          const open = openColumns.has(ci)
          const shown = open ? col.people : col.people.slice(0, CARDS_PER_COLUMN)
          return (
            <div className={`bd-col${ci === 0 ? ' bd-lead' : ''}`} key={col.industry}>
              <div className="bd-col-head">
                <span className="bd-name">{col.industry}</span>
                <span className="bd-count">{col.people.length}</span>
              </div>
              {shown.map(p => (
                <div className="bd-card" key={p.id}>
                  <span className="bd-ava">
                    <span className="bd-init">{initials(p.n)}</span>
                    {p.av && (
                      <img
                        src={p.av}
                        alt=""
                        loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                  </span>
                  <span className="bd-text">
                    <span className="bd-pname">
                      {p.n} {p.y && <span>{shortYear(p.y)}</span>}
                    </span>
                    <span className="bd-prole">{nowLine(p)}</span>
                  </span>
                  {/* Siblings, not nested: buttons inside buttons are invalid
                      DOM and unreachable by keyboard. */}
                  <button
                    className="bd-card-open"
                    aria-label={`View ${p.n}’s circle`}
                    onClick={() => onPick(p)}
                  />
                  <button
                    className={`bd-save${savedIds.has(p.id) ? ' bd-saved' : ''}`}
                    aria-label={savedIds.has(p.id) ? `${p.n} saved` : `Save ${p.n}`}
                    onClick={() => { if (!savedIds.has(p.id)) onSave(p.id) }}
                  >
                    {savedIds.has(p.id) ? 'Saved ✓' : 'Save'}
                  </button>
                </div>
              ))}
              {col.people.length > CARDS_PER_COLUMN && (
                <div className="bd-col-foot">
                  <button
                    onClick={() => setOpenColumns(prev => {
                      const next = new Set(prev)
                      if (next.has(ci)) next.delete(ci)
                      else next.add(ci)
                      return next
                    })}
                  >
                    {open ? 'Show fewer' : `All ${col.people.length} →`}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {board.restIndustries.length > 0 &&
        chipRow(board.restIndustries, chipsOpen.industries, () => setChipsOpen(c => ({ ...c, industries: !c.industries })), 'bd-chips-ind')}
      {board.cities.length > 0 &&
        chipRow(board.cities, chipsOpen.cities, () => setChipsOpen(c => ({ ...c, cities: !c.cities })), 'bd-chips-city')}
    </section>
  )
}
