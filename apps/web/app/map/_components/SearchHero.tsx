import { useId, useRef, useState } from 'react'
import Avatar from '@/components/Avatar'
import type { Dataset } from '../_lib/data'
import type { Person } from '../_lib/types'

interface Props {
  ds: Dataset
  onPick: (p: Person) => void
}

export default function SearchHero({ ds, onPick }: Props) {
  const [text, setText] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [active, setActive] = useState(-1)
  const listId = useId()
  const debounce = useRef<number>()

  function onChange(v: string) {
    setText(v)
    window.clearTimeout(debounce.current)
    debounce.current = window.setTimeout(() => {
      setResults(v.trim().length >= 2 ? ds.fuse.search(v.trim(), { limit: 8 }).map(r => r.item) : [])
      setActive(-1)
    }, 120)
  }

  function pick(p: Person) {
    onPick(p)
    setText('')
    setResults([])
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % results.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + results.length) % results.length) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[Math.max(0, active)]) }
    else if (e.key === 'Escape') { setText(''); setResults([]) }
  }

  return (
    <div className="search-hero" role="combobox" aria-expanded={results.length > 0} aria-haspopup="listbox" aria-owns={listId}>
      <div className="search-hero-inner">
        <svg className="search-hero-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667ZM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <input
          type="search"
          value={text}
          placeholder="Search a name or company"
          aria-label="Search alumni"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {results.length > 0 && (
        <ul className="search-hero-list" role="listbox" id={listId}>
          <li className="search-hero-result-count" role="presentation">
            {results.length} result{results.length === 1 ? '' : 's'}
          </li>
          {results.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={e => { e.preventDefault(); pick(p) }}
              onMouseEnter={() => setActive(i)}
            >
              <Avatar name={p.n} imageUrl={p.av} size="sm" />
              <span className="sug-body">
                <span className="sug-name">{p.n}{p.y ? ` '${String(p.y).slice(2)}` : ''}</span>
                <span className="sug-meta">
                  {[ds.data.sports[p.sp[0]], p.co ?? p.lo].filter(Boolean).join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
