import { useMemo, useState } from 'react'
import type { Dataset } from '../_lib/data'
import type { Person, SavedContact } from '../_lib/types'
import { seasonsShared, yearsOverlap } from '../_lib/overlap'
import PersonHoverCard from './PersonHoverCard'

const W = 680
const H = 520
const CX = W / 2
const CY = H / 2 + 8
const RX = W / 2 - 110
const RY = H / 2 - 78

interface Props {
  ds: Dataset
  saved: SavedContact[]
  onPick: (p: Person) => void
}

interface Node {
  p: Person
  x: number
  y: number
  angle: number
}

/**
 * The student's saved network as a web: contacts on a ring (ordered by class
 * year), edges where two of them were on campus together. Solid accent edges
 * are teammates. This only ever renders the SAVED network — it's the student's
 * own web, not a directory visualization.
 */
export default function NetworkWeb({ ds, saved, onPick }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null)

  const { nodes, edges } = useMemo(() => {
    const people = saved
      .map(s => ds.byId.get(s.alumniId))
      .filter((p): p is Person => !!p)
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0))

    const nodes: Node[] = people.map((p, i) => {
      const angle = (i / people.length) * 2 * Math.PI - Math.PI / 2
      return { p, x: CX + RX * Math.cos(angle), y: CY + RY * Math.sin(angle), angle }
    })

    const edges: { a: Node; b: Node; team: boolean; seasons: number }[] = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pa = nodes[i].p, pb = nodes[j].p
        if (!yearsOverlap(pa, pb)) continue
        const team = pa.sp.some(s => ds.compatibleSports[s].some(cs => pb.sp.includes(cs)))
        edges.push({ a: nodes[i], b: nodes[j], team, seasons: seasonsShared(pa, pb) })
      }
    }
    return { nodes, edges }
  }, [ds, saved])

  if (nodes.length < 2) {
    return (
      <div className="web-empty">
        <p>
          {nodes.length === 0
            ? 'Search any athlete. Save contacts and your web builds itself here.'
            : 'One more saved contact and your web appears.'}
        </p>
      </div>
    )
  }

  const tieCount = edges.length
  const hoverNode = hoverId ? nodes.find(n => n.p.id === hoverId) ?? null : null
  const dimmed = (n: Node) =>
    hoverId !== null && n.p.id !== hoverId && !edges.some(e =>
      (e.a.p.id === hoverId && e.b.p.id === n.p.id) || (e.b.p.id === hoverId && e.a.p.id === n.p.id))

  return (
    <section className="network-web" aria-label="Your network's Cornell web">
      <h3>Your network's web</h3>
      <p className="web-sub">
        {nodes.length} {nodes.length === 1 ? 'contact' : 'contacts'} · {tieCount} campus {tieCount === 1 ? 'tie' : 'ties'}
      </p>

      <div className="web-stage">
      <svg viewBox={`0 0 ${W} ${H}`} className="web-svg" role="img" aria-label={`Web of ${nodes.length} saved contacts`}>
        {edges.map((e, i) => {
          const active = hoverId === e.a.p.id || hoverId === e.b.p.id
          return (
            <line
              key={i}
              x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
              className={`web-edge ${e.team ? 'web-edge-team' : 'web-edge-era'} ${hoverId ? (active ? 'web-edge-active' : 'web-edge-dim') : ''}`}
            >
              <title>
                {e.a.p.n} & {e.b.p.n} — {e.team ? `teammates, ${e.seasons} season${e.seasons === 1 ? '' : 's'}` : 'on campus together'}
              </title>
            </line>
          )
        })}
        {nodes.map(n => {
          const labelLeft = Math.cos(n.angle) < -0.2
          const labelAbove = Math.sin(n.angle) < -0.6
          return (
            <g
              key={n.p.id}
              className={`web-node ${dimmed(n) ? 'web-node-dim' : ''}`}
              transform={`translate(${n.x},${n.y})`}
              onMouseEnter={() => setHoverId(n.p.id)}
              onMouseLeave={() => setHoverId(h => (h === n.p.id ? null : h))}
              onClick={() => onPick(n.p)}
              tabIndex={0}
              role="button"
              aria-label={`${n.p.n}, open their circle`}
              onKeyDown={e => { if (e.key === 'Enter') onPick(n.p) }}
            >
              <circle r="15" />
              <text className="web-initials" dy="4">{initials(n.p.n)}</text>
              <text
                className="web-label"
                x={labelAbove ? 0 : labelLeft ? -20 : 20}
                y={labelAbove ? -22 : 4}
                textAnchor={labelAbove ? 'middle' : labelLeft ? 'end' : 'start'}
              >
                {shortName(n.p.n)}{n.p.y ? ` '${String(n.p.y).slice(2)}` : ''}
              </text>
            </g>
          )
        })}
      </svg>
      {hoverNode && (
        <div
          className="web-card-anchor"
          style={{
            left: `${(hoverNode.x / W) * 100}%`,
            top: `${(hoverNode.y / H) * 100}%`,
            transform: hoverNode.x > W * 0.62
              ? 'translate(calc(-100% - 24px), -50%)'
              : 'translate(24px, -50%)',
          }}
        >
          <PersonHoverCard ds={ds} person={hoverNode.p} />
        </div>
      )}
      </div>

      <p className="web-legend">
        <span className="web-swatch web-swatch-team" /> played together
        <span className="web-swatch web-swatch-era" /> on campus together
      </p>
    </section>
  )
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function shortName(n: string): string {
  const parts = n.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : n
}
