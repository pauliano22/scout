import Avatar from '@/components/Avatar'
import type { Dataset } from '../_lib/data'
import type { Person } from '../_lib/types'

interface Props {
  ds: Dataset
  person: Person
  /** Extra context line, e.g. "3 seasons together" */
  note?: string
  /** Called when user clicks "View circle" */
  onViewCircle?: () => void
  /** Called when user clicks "Save" — undefined hides the button */
  onSave?: () => void
  /** Whether this person is already saved */
  isSaved?: boolean
}

/**
 * The profile card that follows hover targets across Circles — photo, role,
 * company, sport, location, and clear action paths (view circle, save, linkedin).
 */
export default function PersonHoverCard({ ds, person: p, note, onViewCircle, onSave, isSaved }: Props) {
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
      <div className="hc-actions">
        {onViewCircle && (
          <button className="hc-action hc-action-circle" onClick={onViewCircle}>
            View circle →
          </button>
        )}
        {onSave && !isSaved && (
          <button className="hc-action hc-action-save" onClick={onSave}>
            + Save
          </button>
        )}
        {isSaved && (
          <span className="hc-saved-badge">✓ Saved</span>
        )}
        {p.li && (
          <a className="hc-action hc-action-li" href={p.li} target="_blank" rel="noopener noreferrer">
            LinkedIn ↗
          </a>
        )}
      </div>
    </div>
  )
}
