import { useMemo, useState } from 'react'
import type { Dataset } from '../_lib/data'
import type { Person } from '../_lib/types'
import { seasonsShared } from '../_lib/overlap'
import PersonHoverCard from './PersonHoverCard'

const ROWS_STEP = 12

interface Props {
  ds: Dataset
  ego: Person
  mates: Person[]   // pre-sorted by seasons shared desc
  onPick: (p: Person) => void
}

/**
 * "Seasons together" chart: one row per teammate, a bar for their years at
 * Cornell, with the stretch they shared with the selected person highlighted.
 */
export default function TeamTimeline({ ds, ego, mates, onPick }: Props) {
  const [rows, setRows] = useState(ROWS_STEP)
  const [hover, setHover] = useState<{ p: Person; row: number } | null>(null)

  const { lo, hi, ticks } = useMemo(() => {
    const visible = mates.slice(0, rows)
    let lo = ego.a!, hi = ego.b!
    for (const m of visible) { lo = Math.min(lo, m.a!); hi = Math.max(hi, m.b!) }
    lo -= 1; hi += 1
    const span = hi - lo
    const step = span > 24 ? 8 : span > 12 ? 4 : 2
    const ticks: number[] = []
    for (let y = Math.ceil(lo / step) * step; y <= hi; y += step) ticks.push(y)
    return { lo, hi, ticks }
  }, [ego, mates, rows])

  const pct = (year: number) => ((year - lo) / (hi - lo)) * 100

  if (ego.a == null || !mates.length) return null

  return (
    <div className="timeline">
      <div className="tl-axis" aria-hidden="true">
        <span className="tl-axis-label" />
        <div className="tl-axis-track">
          {ticks.map(t => (
            <span key={t} className="tl-tick" style={{ left: `${pct(t)}%` }}>{`'${String(t).slice(2)}`}</span>
          ))}
          <span className="tl-ego-band" style={{ left: `${pct(ego.a)}%`, width: `${pct(ego.b!) - pct(ego.a)}%` }} />
        </div>
      </div>

      <div className="tl-row tl-row-ego" aria-label={`${ego.n}, on campus ${ego.a} to ${ego.b}`}>
        <span className="tl-name">{shortName(ego.n)}</span>
        <div className="tl-track">
          <span className="tl-ego-band" style={{ left: `${pct(ego.a)}%`, width: `${pct(ego.b!) - pct(ego.a)}%` }} />
          <span className="tl-bar tl-bar-ego" style={{ left: `${pct(ego.a)}%`, width: `${pct(ego.b!) - pct(ego.a)}%` }} />
        </div>
      </div>

      {mates.slice(0, rows).map((m, idx) => {
        const shared = seasonsShared(ego, m)
        const oLo = Math.max(ego.a!, m.a!)
        const oHi = Math.min(ego.b!, m.b!)
        return (
          <button
            key={m.id}
            className="tl-row"
            onClick={() => onPick(m)}
            onMouseEnter={() => setHover({ p: m, row: idx })}
            onMouseLeave={() => setHover(h => (h?.p.id === m.id ? null : h))}
          >
            <span className="tl-name">{shortName(m.n)}{m.y ? ` '${String(m.y).slice(2)}` : ''}</span>
            <div className="tl-track">
              <span className="tl-ego-band" style={{ left: `${pct(ego.a!)}%`, width: `${pct(ego.b!) - pct(ego.a!)}%` }} />
              <span className="tl-bar" style={{ left: `${pct(m.a!)}%`, width: `${pct(m.b!) - pct(m.a!)}%` }} />
              {shared > 0 && (
                <span className="tl-bar tl-bar-shared" style={{ left: `${pct(oLo)}%`, width: `${pct(oHi) - pct(oLo)}%` }} />
              )}
            </div>
          </button>
        )
      })}

      {hover && (
        <div className="tl-card-anchor" style={{ top: `${44 + (hover.row + 1) * 32}px` }}>
          <PersonHoverCard
            ds={ds}
            person={hover.p}
            note={`${seasonsShared(ego, hover.p)} season${seasonsShared(ego, hover.p) === 1 ? '' : 's'} with ${ego.n.split(' ')[0]}`}
            onViewCircle={() => onPick(hover.p)}
          />
        </div>
      )}

      <div className="tl-foot">
        <span className="tl-legend">
          <i className="tl-swatch tl-swatch-shared" /> seasons together
          <i className="tl-swatch tl-swatch-solo" /> their other years
        </span>
        {mates.length > rows && (
          <button className="link-btn" onClick={() => setRows(r => r + ROWS_STEP)}>
            More ({mates.length - rows})
          </button>
        )}
      </div>
    </div>
  )
}

function shortName(n: string): string {
  const parts = n.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : n
}
