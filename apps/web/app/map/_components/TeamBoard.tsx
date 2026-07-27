import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Dataset } from '../_lib/data'
import type { Person, SavedContact } from '../_lib/types'
import { warmFor } from '../_lib/overlap'
import { trackEvent } from '@/lib/track'
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
const EXPAND_STEP = 12

export default function TeamBoard({ ds, sportIndices, saved, onSave, onPick }: Props) {
  // Per-column visible-card count; columns expand in steps, not all at once.
  const [colRows, setColRows] = useState<Record<number, number>>({})

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

    return { total: people.length, columns }
  }, [ds, sportIndices])

  if (board.columns.length === 0) return null

  const savedIds = new Set(saved.map(s => s.alumniId))
  const sportLabel = ds.data.sportMeta[sportIndices[0]]?.f ?? ds.data.sports[sportIndices[0]] ?? 'team'

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
          const shownCount = colRows[ci] ?? CARDS_PER_COLUMN
          const shown = col.people.slice(0, shownCount)
          const remaining = col.people.length - shown.length
          return (
            <div className={`bd-col${ci === 0 ? ' bd-lead' : ''}`} key={col.industry}>
              <div className="bd-col-head">
                <span className="bd-name">{col.industry}</span>
                <span className="bd-count">{col.people.length}</span>
              </div>
              {shown.map(p => (
                <BoardCard
                  key={p.id}
                  ds={ds}
                  person={p}
                  isSaved={savedIds.has(p.id)}
                  saved={saved}
                  onSave={onSave}
                  onPick={onPick}
                />
              ))}
              {(remaining > 0 || shownCount > CARDS_PER_COLUMN) && (
                <div className="bd-col-foot">
                  {remaining > 0 ? (
                    <button onClick={() => setColRows(prev => ({ ...prev, [ci]: shownCount + EXPAND_STEP }))}>
                      Show {Math.min(EXPAND_STEP, remaining)} more
                    </button>
                  ) : (
                    <button onClick={() => setColRows(prev => ({ ...prev, [ci]: CARDS_PER_COLUMN }))}>
                      Show fewer
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function BoardCard({ ds, person: p, isSaved, saved, onSave, onPick }: {
  ds: Dataset
  person: Person
  isSaved: boolean
  saved: SavedContact[]
  onSave: (alumniId: string) => void
  onPick: (p: Person) => void
}) {
  const warm = useMemo(() => warmFor(ds, p, saved), [ds, p, saved])

  return (
    <div className="bd-card">
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
        {warm.length > 0 && !isSaved && (
          <span className="bd-warm">
            {warm[0].contact.n}{warm.length > 1 ? ` +${warm.length - 1}` : ''} can introduce you
          </span>
        )}
      </span>
      {/* Card open + Save/Saved are sibling elements (nested interactives are
          invalid DOM). The overlay makes the whole card the click target; the
          always-visible pill sits above it via z-index. */}
      <button
        className="bd-card-open"
        aria-label={`View ${p.n}’s circle`}
        onClick={() => onPick(p)}
      />
      {isSaved ? (
        <Link
          className="bd-savedchip"
          href={`/network?highlight=${p.id}`}
          aria-label={`${p.n} saved — draft outreach`}
          onClick={() => trackEvent('circles_outreach_clicked', { alumni_id: p.id })}
        >
          Saved ✓
        </Link>
      ) : (
        <button
          className="bd-save"
          aria-label={`Save ${p.n}`}
          onClick={() => onSave(p.id)}
        >
          Save
        </button>
      )}
    </div>
  )
}
