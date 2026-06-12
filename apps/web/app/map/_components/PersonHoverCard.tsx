import Avatar from '@/components/Avatar'
import type { Dataset } from '../_lib/data'
import type { Person } from '../_lib/types'

interface Props {
  ds: Dataset
  person: Person
  /** Extra context line, e.g. "3 seasons together" */
  note?: string
}

/**
 * The profile card that follows hover targets across Circles — photo, role,
 * company, sport, location. Presentational only; the parent positions it.
 */
export default function PersonHoverCard({ ds, person: p, note }: Props) {
  const work = [p.ro, p.co].filter(Boolean).join(' @ ')
  return (
    <div className="hover-card" role="tooltip">
      <div className="hc-top">
        <Avatar name={p.n} imageUrl={p.av} size="lg" />
        <div className="hc-id">
          <span className="hc-name">{p.n}</span>
          <span className="hc-sport">
            {p.sp.map(s => ds.data.sports[s]).join(' · ')}
            {p.y ? ` · '${String(p.y).slice(2)}` : ''}
          </span>
        </div>
      </div>
      {(work || p.hl) && <p className="hc-work">{work || p.hl}</p>}
      {(p.in != null || p.lo) && (
        <p className="hc-meta">{[p.in != null ? ds.data.industries[p.in] : null, p.lo].filter(Boolean).join(' · ')}</p>
      )}
      {note && <p className="hc-note">{note}</p>}
    </div>
  )
}
