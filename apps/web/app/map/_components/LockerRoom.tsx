import { useMemo, useState } from 'react'
import type { Dataset } from '../_lib/data'
import type { Person } from '../_lib/types'
import { sameEra, seasonsShared, teammates } from '../_lib/overlap'
import { initials, nowLine, shortYear } from '../_lib/now'

interface Props {
  ds: Dataset
  self: Person
  onPick: (p: Person) => void
}

interface Cohort {
  year: number | null
  people: Person[]
}

// Show roughly this many cards before folding the rest behind the more-tile.
const INITIAL_CARDS = 24

export default function LockerRoom({ ds, self, onPick }: Props) {
  const [expanded, setExpanded] = useState(false)

  const { cohorts, mateCount, eraCount } = useMemo(() => {
    const mates = teammates(ds, self)
    const byYear = new Map<number | null, Person[]>()
    for (const m of mates) {
      const y = m.y ?? null
      if (!byYear.has(y)) byYear.set(y, [])
      byYear.get(y)!.push(m)
    }
    // Own class first, then nearest classes (younger before older on ties);
    // within a cohort, faces first.
    const selfY = self.y ?? 0
    const cohorts: Cohort[] = [...byYear.entries()]
      .sort(([a], [b]) => {
        if (a == null) return 1
        if (b == null) return -1
        return Math.abs(a - selfY) - Math.abs(b - selfY) || b - a
      })
      .map(([year, people]) => ({
        year,
        people: people.sort((p, q) => (q.av ? 1 : 0) - (p.av ? 1 : 0) || p.n.localeCompare(q.n)),
      }))
    return { cohorts, mateCount: mates.length, eraCount: sameEra(ds, self).length }
  }, [ds, self])

  if (!mateCount) return null

  // The collapsed prefix is computed unconditionally so the expander can stay
  // mounted as a toggle — unmounting the focused control drops keyboard focus.
  const collapsed: Cohort[] = []
  let hiddenCount = 0
  {
    let cards = 0
    for (const c of cohorts) {
      if (collapsed.length && cards >= INITIAL_CARDS) { hiddenCount += c.people.length; continue }
      collapsed.push(c)
      cards += c.people.length
    }
  }
  const visible = expanded ? cohorts : collapsed
  const hiddenYears = cohorts.slice(collapsed.length).map(c => (c.year ? shortYear(c.year) : 'unknown'))

  const sport = ds.data.sports[self.sp[0]] ?? 'team'
  const years = self.a != null ? `${self.a}–${self.b}` : null

  return (
    <section aria-label="Your locker room">
      <div className="ld-head">
        <p className="ld-eyebrow">Cornell {sport}</p>
        <h2>Your locker room</h2>
        <p className="ld-sub">
          The {mateCount.toLocaleString()} teammates from your
          {years ? ` ${years} seasons` : ' seasons'} — and what they&rsquo;re doing now.
        </p>
      </div>

      {visible.map(cohort => (
        <div className="lr-cohort" key={cohort.year ?? 'none'}>
          <div className="lr-cohort-head">
            <span className="lr-yr">
              Class of {cohort.year ? shortYear(cohort.year) : 'unknown'}
              {cohort.year === self.y && <span className="lr-you"> · your class</span>}
            </span>
            <span className="lr-rule" />
            <span className="lr-count">{cohort.people.length}</span>
          </div>
          <div className="lr-grid">
            {cohort.people.map(p => (
              <button
                key={p.id}
                className="lr-card"
                onClick={() => onPick(p)}
                title={seasonsShared(self, p) > 0 ? `${seasonsShared(self, p)} seasons together` : 'On campus together'}
              >
                <span className="lr-ava">
                  <span className="lr-ava-fallback">{initials(p.n)}</span>
                  {p.av && (
                    <img
                      src={p.av}
                      alt=""
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                </span>
                <span className="lr-nm">
                  {p.n}
                  {p.y && <span className="lr-tick">{shortYear(p.y)}</span>}
                </span>
                <span className={`lr-now${p.ro || p.co ? '' : ' lr-muted'}`}>{nowLine(p)}</span>
              </button>
            ))}
            {hiddenCount > 0 && cohort === visible[visible.length - 1] && (
              <button className="lr-more" aria-expanded={expanded} onClick={() => setExpanded(e => !e)}>
                <span className="lr-plus">{expanded ? '–' : '+'}</span>
                <span className="lr-t1">{expanded ? 'Show fewer' : `${hiddenCount} more teammates`}</span>
                <span className="lr-t2">{expanded ? 'back to recent classes' : `${hiddenYears.join(', ')} classes`}</span>
              </button>
            )}
          </div>
        </div>
      ))}

      <p className="lr-foot">
        {mateCount.toLocaleString()} teammates · {eraCount.toLocaleString()} more on campus in your era
      </p>
    </section>
  )
}
