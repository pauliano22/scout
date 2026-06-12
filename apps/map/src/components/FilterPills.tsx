import type { Dataset } from '../data'
import type { Filters } from '../types'
import { useAppDispatch, useAppState } from '../state'

/** Active filters as removable pills — makes the current "lens" legible at a glance. */
export default function FilterPills({ ds }: { ds: Dataset }) {
  const { filters } = useAppState()
  const dispatch = useAppDispatch()
  const pills: { key: string; label: string; remove: () => void }[] = []
  const patch = (p: Partial<Filters>) => dispatch({ type: 'patchFilters', patch: p })

  if (filters.cohort) {
    const ego = ds.byId.get(filters.cohort.id)
    if (ego) {
      const year = ego.y ? ` '${String(ego.y).slice(2)}` : ''
      pills.push({
        key: 'cohort',
        label: filters.cohort.mode === 'team' ? `Teammates of ${ego.n}${year}` : `On campus with ${ego.n}${year}`,
        remove: () => patch({ cohort: null }),
      })
    }
  }
  for (const s of filters.sports) {
    pills.push({
      key: `sp${s}`,
      label: ds.data.sports[s],
      remove: () => patch({ sports: filters.sports.filter(x => x !== s) }),
    })
  }
  if (filters.years) {
    pills.push({ key: 'y', label: `${filters.years[0]}–${filters.years[1]}`, remove: () => patch({ years: null }) })
  }
  for (const i of filters.industries) {
    pills.push({
      key: `in${i}`,
      label: ds.data.industries[i],
      remove: () => patch({ industries: filters.industries.filter(x => x !== i) }),
    })
  }
  if (filters.company.trim()) {
    pills.push({ key: 'co', label: `Company: ${filters.company.trim()}`, remove: () => patch({ company: '' }) })
  }
  if (filters.loc.trim()) {
    pills.push({ key: 'lo', label: `Location: ${filters.loc.trim()}`, remove: () => patch({ loc: '' }) })
  }
  if (filters.near) {
    pills.push({ key: 'near', label: `Near ${filters.near.label}`, remove: () => patch({ near: null }) })
  }
  if (filters.q.trim()) {
    pills.push({ key: 'q', label: `"${filters.q.trim()}"`, remove: () => patch({ q: '' }) })
  }

  if (!pills.length) return null

  return (
    <div className="filter-pills" aria-label="Active filters">
      {pills.map(p => (
        <button key={p.key} className="pill" onClick={p.remove} title="Remove this filter">
          {p.label} <span aria-hidden="true">✕</span>
        </button>
      ))}
      {pills.length > 1 && (
        <button className="link-btn" onClick={() => dispatch({ type: 'clearFilters' })}>Clear all</button>
      )}
    </div>
  )
}
