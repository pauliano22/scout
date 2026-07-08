import { useMemo } from 'react'
import type { Dataset } from '../_lib/data'
import type { Person, SavedContact } from '../_lib/types'
import { sameEra, seasonsShared, teammates, yearsOverlap } from '../_lib/overlap'
import Avatar from '@/components/Avatar'
import TeamTimeline from './TeamTimeline'

interface Props {
  ds: Dataset
  person: Person
  saved: SavedContact[]
  onSave: (alumniId: string) => void
  onPick: (p: Person) => void
}

const STATUS_LABEL: Record<string, string> = {
  interested: 'saved',
  awaiting_reply: 'you reached out',
  response_needed: 'they replied',
  meeting_scheduled: 'meeting set',
  met: 'you met',
}

export default function PersonCircle({ ds, person: p, saved, onSave, onPick }: Props) {
  const isSaved = saved.some(s => s.alumniId === p.id)
  const mates = useMemo(
    () => teammates(ds, p).sort((a, b) => seasonsShared(p, b) - seasonsShared(p, a) || (b.y ?? 0) - (a.y ?? 0)),
    [ds, p]
  )
  const eraCount = useMemo(() => (p.a != null ? sameEra(ds, p).length : 0), [ds, p])

  const warm = useMemo(() => {
    const mateIds = new Set(mates.map(m => m.id))
    return saved
      .filter(s => s.alumniId !== p.id)
      .flatMap(s => {
        const c = ds.byId.get(s.alumniId)
        if (!c || !yearsOverlap(p, c)) return []
        return [{ contact: c, status: s.status, teammate: mateIds.has(c.id), seasons: seasonsShared(p, c) }]
      })
      .sort((a, b) => Number(b.teammate) - Number(a.teammate) || b.seasons - a.seasons)
  }, [ds, p, saved, mates])

  const work = [p.ro, p.co].filter(Boolean).join(' @ ')

  return (
    <section className="person-circle" aria-label={`Circle of ${p.n}`}>
      <div className="pc-identity">
        <Avatar name={p.n} imageUrl={p.av} size="xl" />
        <div className="pc-id-body">
          <h2>{p.n}</h2>
          <p className="pc-sport">
            {p.sp.map(s => ds.data.sports[s]).join(' · ')}
            {p.y ? <> · Class of '{String(p.y).slice(2)}</> : null}
          </p>
          {(work || p.hl) && <p className="pc-work">{work || p.hl}</p>}
          <p className="pc-meta">{[p.in != null ? ds.data.industries[p.in] : null, p.lo].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="pc-actions">
          {isSaved ? (
            <span className="pc-saved">✓ Saved</span>
          ) : (
            <button className="pc-save" onClick={() => onSave(p.id)}>Save</button>
          )}
          {p.li && (
            <a className="pc-linkedin" href={p.li} target="_blank" rel="noopener noreferrer">LinkedIn</a>
          )}
        </div>
      </div>

      {p.a != null && mates.length > 0 ? (
        <div className="pc-timeline">
          <h3>Who they played with</h3>
          <TeamTimeline ds={ds} ego={p} mates={mates} onPick={onPick} />
          <p className="pc-era muted">
            {mates.length.toLocaleString()} teammates · {eraCount.toLocaleString()} more on campus at the same time
          </p>
        </div>
      ) : (
        <p className="muted">No class year on record, so seasons can't be matched for this profile.</p>
      )}
    </section>
  )
}
