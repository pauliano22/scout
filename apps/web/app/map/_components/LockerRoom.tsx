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

interface Group {
  key: string
  label: string
  people: Person[]
}

// Show roughly this many cards before folding the rest behind the more-tile.
const INITIAL_CARDS = 24

export default function LockerRoom({ ds, self, onPick }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showRest, setShowRest] = useState(false)

  // Group the alum's own teammates by WHERE THEY LANDED, not by class year.
  // The student board answers "where did this team go"; the alumni locker room
  // used to answer "who was on my team", which the alum already knows — the
  // interesting half is the destinations. Same people, same cards, sorted into
  // industry circles instead of class cohorts.
  const { groups, rest, mateCount, eraCount, placedCount, circleCount } = useMemo(() => {
    const mates = teammates(ds, self)

    const byIndustry = new Map<number, Person[]>()
    const unplaced: Person[] = []
    for (const m of mates) {
      // Matches the student board's bar: an industry alone, with no role and no
      // company behind it, isn't a destination worth showing.
      if (m.in == null || (!m.ro && !m.co)) { unplaced.push(m); continue }
      if (!byIndustry.has(m.in)) byIndustry.set(m.in, [])
      byIndustry.get(m.in)!.push(m)
    }

    // Newest classes first inside a circle — recent grads reply. Faces before
    // placeholders on ties, then name so the order is stable across renders.
    const byRecency = (p: Person, q: Person) =>
      (q.y ?? 0) - (p.y ?? 0) || (q.av ? 1 : 0) - (p.av ? 1 : 0) || p.n.localeCompare(q.n)

    const groups: Group[] = [...byIndustry.entries()]
      .map(([ind, people]) => ({
        key: String(ind),
        label: ds.data.industries[ind],
        people: people.sort(byRecency),
      }))
      // Biggest circle first — that's the one with a real network in it.
      .sort((a, b) => b.people.length - a.people.length || a.label.localeCompare(b.label))

    // Never silently drop a teammate — an alum knows exactly who they played
    // with, and a missing name reads as a broken product rather than as missing
    // data. But they don't belong in the circles either: career coverage on the
    // baked dataset averages ~23% of a given alum's teammates, so folding them
    // in as a pseudo-circle would bury three real destinations under eighty
    // unknowns. They get their own collapsed section under the circles instead.
    return {
      groups,
      rest: unplaced.sort(byRecency),
      mateCount: mates.length,
      eraCount: sameEra(ds, self).length,
      placedCount: mates.length - unplaced.length,
      circleCount: groups.length,
    }
  }, [ds, self])

  if (!mateCount) return null

  // The collapsed prefix is computed unconditionally so the expander can stay
  // mounted as a toggle — unmounting the focused control drops keyboard focus.
  const collapsed: Group[] = []
  let hiddenCount = 0
  {
    let cards = 0
    for (const g of groups) {
      if (collapsed.length && cards >= INITIAL_CARDS) { hiddenCount += g.people.length; continue }
      collapsed.push(g)
      cards += g.people.length
    }
  }
  const visible = expanded ? groups : collapsed
  const hiddenLabels = groups.slice(collapsed.length).map(g => g.label)

  const sport = ds.data.sports[self.sp[0]] ?? 'team'
  const years = self.a != null ? `${self.a}–${self.b}` : null

  const card = (p: Person) => {
    const shared = seasonsShared(self, p)
    return (
      <button
        key={p.id}
        className="lr-card"
        onClick={() => onPick(p)}
        title={shared > 0 ? `${shared} seasons together` : 'On campus together'}
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
    )
  }

  return (
    <section aria-label="Where your locker room went">
      <div className="ld-head">
        <p className="ld-eyebrow">Cornell {sport}</p>
        <h2>Where your locker room went</h2>
        <p className="ld-sub">
          {placedCount > 0 ? (
            <>
              {placedCount.toLocaleString()} of your {mateCount.toLocaleString()} teammates from
              {years ? ` your ${years} seasons` : ' your seasons'} landed in{' '}
              {circleCount.toLocaleString()} {circleCount === 1 ? 'field' : 'fields'}.
            </>
          ) : (
            <>
              The {mateCount.toLocaleString()} teammates from your
              {years ? ` ${years} seasons` : ' seasons'} — and what they&rsquo;re doing now.
            </>
          )}
        </p>
      </div>

      {visible.map(group => (
        <div className="lr-cohort" key={group.key}>
          <div className="lr-cohort-head">
            <span className="lr-yr">{group.label}</span>
            <span className="lr-rule" />
            <span className="lr-count">{group.people.length}</span>
          </div>
          <div className="lr-grid">
            {group.people.map(card)}
            {hiddenCount > 0 && group === visible[visible.length - 1] && (
              <button className="lr-more" aria-expanded={expanded} onClick={() => setExpanded(e => !e)}>
                <span className="lr-plus">{expanded ? '–' : '+'}</span>
                <span className="lr-t1">{expanded ? 'Show fewer' : `${hiddenCount} more teammates`}</span>
                <span className="lr-t2">
                  {expanded ? 'back to the biggest circles' : hiddenLabels.slice(0, 3).join(', ')}
                </span>
              </button>
            )}
          </div>
        </div>
      ))}

      {rest.length > 0 && (
        <div className="lr-cohort">
          <div className="lr-cohort-head">
            <span className="lr-yr">No destination on record</span>
            <span className="lr-rule" />
            <span className="lr-count">{rest.length}</span>
          </div>
          {showRest ? (
            <div className="lr-grid">
              {rest.map(card)}
              <button className="lr-more" aria-expanded onClick={() => setShowRest(false)}>
                <span className="lr-plus">–</span>
                <span className="lr-t1">Show fewer</span>
                <span className="lr-t2">back to the circles</span>
              </button>
            </div>
          ) : (
            <div className="lr-grid">
              <button className="lr-more" aria-expanded={false} onClick={() => setShowRest(true)}>
                <span className="lr-plus">+</span>
                <span className="lr-t1">
                  {rest.length.toLocaleString()} teammates we can&rsquo;t place yet
                </span>
                <span className="lr-t2">no company or role on file — open to see them</span>
              </button>
            </div>
          )}
        </div>
      )}

      <p className="lr-foot">
        {mateCount.toLocaleString()} teammates · {eraCount.toLocaleString()} more on campus in your era
      </p>
    </section>
  )
}
