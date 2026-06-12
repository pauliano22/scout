import { useEffect, useId, useRef, useState } from 'react'
import type { Dataset } from '../data'
import type { Person } from '../types'
import { useAppDispatch, useAppState } from '../state'

type Suggestion =
  | { kind: 'person'; p: Person }
  | { kind: 'sport'; idx: number; count: number }

export default function SearchBox({ ds }: { ds: Dataset }) {
  const { filters } = useAppState()
  const dispatch = useAppDispatch()
  const [text, setText] = useState(filters.q)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()
  const debounce = useRef<number>()
  const inputRef = useRef<HTMLInputElement>(null)

  // Reflect external changes (pill removal, URL nav) — but never clobber live typing
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setText(filters.q)
  }, [filters.q])

  function onChange(v: string) {
    setText(v)
    window.clearTimeout(debounce.current)
    debounce.current = window.setTimeout(() => {
      const q = v.trim()
      if (q.length >= 2) {
        const sportSugs: Suggestion[] = ds.data.sports
          .map((s, idx) => ({ s, idx }))
          .filter(({ s }) => s.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 2)
          .map(({ idx }) => ({ kind: 'sport', idx, count: ds.sportCounts[idx] }))
        const peopleSugs: Suggestion[] = ds.fuse.search(q, { limit: 7 }).map(r => ({ kind: 'person', p: r.item }))
        // Browsing a team shouldn't require also matching people by name
        dispatch({ type: 'patchFilters', patch: { q: peopleSugs.length || !sportSugs.length ? v : '' } })
        setSuggestions([...sportSugs, ...peopleSugs])
        setOpen(true)
        setActive(-1)
      } else {
        dispatch({ type: 'patchFilters', patch: { q: v } })
        setSuggestions([])
        setOpen(false)
      }
    }, 150)
  }

  function pick(s: Suggestion) {
    if (s.kind === 'person') {
      dispatch({ type: 'select', id: s.p.id })
    } else {
      dispatch({ type: 'patchFilters', patch: { sports: [...new Set([...filters.sports, s.idx])], q: '' } })
      setText('')
    }
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || !suggestions.length) {
      if (e.key === 'Escape' && text) {
        e.stopPropagation() // clear the box without also closing the profile panel
        setText('')
        dispatch({ type: 'patchFilters', patch: { q: '' } })
      }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % suggestions.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + suggestions.length) % suggestions.length) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(suggestions[active]) }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
  }

  return (
    <div className="searchbox" role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-owns={listId}>
      <svg className="searchbox-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <path d="M8.5 3a5.5 5.5 0 0 1 4.23 9.02l4.12 4.13-1.06 1.06-4.13-4.12A5.5 5.5 0 1 1 8.5 3zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={text}
        placeholder="Search a name, company, or team…"
        aria-label="Search alumni"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <ul className="searchbox-list" role="listbox" id={listId}>
          {suggestions.map((s, i) => (
            <li
              key={s.kind === 'person' ? s.p.id : `sport-${s.idx}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`${i === active ? 'active' : ''} ${s.kind === 'sport' ? 'sug-sport' : ''}`}
              onMouseDown={e => { e.preventDefault(); pick(s) }}
              onMouseEnter={() => setActive(i)}
            >
              {s.kind === 'sport' ? (
                <>
                  <span className="sug-name">Browse {ds.data.sports[s.idx]} →</span>
                  <span className="sug-meta">{s.count.toLocaleString()} alumni · filters the map to the whole team</span>
                </>
              ) : (
                <>
                  <span className="sug-name">{s.p.n}{s.p.y ? ` '${String(s.p.y).slice(2)}` : ''}</span>
                  <span className="sug-meta">
                    {[ds.data.sports[s.p.sp[0]], s.p.co ?? s.p.lo].filter(Boolean).join(' · ')}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
