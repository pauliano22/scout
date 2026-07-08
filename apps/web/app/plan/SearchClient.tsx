'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/track'
import SportAvatar from '@/components/SportAvatar'
import AlumniDetailModal, { type AlumniBase } from '@/components/AlumniDetailModal'
import type { Profile, Alumni } from '@scout/shared/types/database'
import { ArrowUp, Loader2, Plus, Check, Linkedin, Trash2 } from 'lucide-react'

// ── Response shape (mirrors AlumniSearchResponse in the route) ──────────────
interface SearchIntent {
  searchPhrase: string
  soft: { industries: string[]; roles: string[]; locations: string[]; themes: string[] }
  hard: { location?: string; graduationYearMin?: number; graduationYearMax?: number }
  exclude: string[]
  clarifyingQuestion: string | null
}
interface SearchMatch { alumnus: Alumni; reasoning: string }
interface SearchResponse {
  intent: SearchIntent
  matches: SearchMatch[]
  clarifying_question: string | null
  no_matches_reason: string | null
}

interface Turn {
  id: string
  query: string
  status: 'pending' | 'done' | 'error'
  intentSummary?: string | null
  matches?: SearchMatch[]
  clarifyingQuestion?: string | null
  noMatchesReason?: string | null
  errorText?: string
}

// Local fallback if no dynamic suggestions are passed (keeps this component
// self-sufficient and the landing cards never empty).
const EXAMPLES = [
  'Alumni in finance in New York',
  'People who work at Google or Amazon',
  'Alumni who went into consulting',
  'Recent grads working in marketing',
]

// Where a search originated — logged so trending counts only genuine typed
// queries, not example/suggestion chip clicks.
type SearchSource = 'typed' | 'example' | 'suggestion'

let idSeq = 0
const nextId = () => `t${idSeq++}_${Date.now().toString(36)}`

interface SearchClientProps {
  userId: string
  profile: Profile
  networkAlumniIds: string[]
  suggestions?: string[]
}

export default function SearchClient({ userId, profile, networkAlumniIds, suggestions }: SearchClientProps) {
  const supabase = createClient()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [networkIds, setNetworkIds] = useState<Set<string>>(new Set(networkAlumniIds))
  const [addingId, setAddingId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AlumniBase | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const firstName = profile.full_name?.split(' ')[0] || 'there'
  const active = turns.length > 0

  // Keep the latest turn in view as the conversation grows.
  useEffect(() => {
    if (active) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, active])

  async function send(
    text: string,
    source: SearchSource = 'typed',
    overrides?: { dropLocation?: boolean; broadenRole?: boolean },
  ) {
    const q = text.trim()
    if (!q || busy) return
    const id = nextId()
    const history = turns.map((t) => t.query)
    setTurns((prev) => [...prev, { id, query: q, status: 'pending' }])
    setInput('')
    setBusy(true)
    trackEvent('alumni_search_query', { length: q.length, source })

    try {
      const res = await fetch('/api/alumni-search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: q, history, source, overrides }),
      })
      if (res.status === 503) throw new Error('rolling-out')
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as SearchResponse
      setTurns((prev) => prev.map((t) => t.id === id ? {
        ...t, status: 'done',
        intentSummary: buildIntentSummary(data),
        matches: data.matches ?? [],
        clarifyingQuestion: data.clarifying_question,
        noMatchesReason: data.no_matches_reason,
      } : t))
      trackEvent('alumni_search_result', { matches: data.matches?.length ?? 0 })
    } catch (err: any) {
      const rolling = err?.message === 'rolling-out'
      setTurns((prev) => prev.map((t) => t.id === id ? {
        ...t, status: 'error',
        errorText: rolling ? 'Search is still rolling out for your account.' : 'Something went wrong. Try again in a moment.',
      } : t))
    } finally {
      setBusy(false)
    }
  }

  function clearChat() {
    setTurns([])
    setInput('')
    setDetail(null)
    trackEvent('alumni_search_cleared')
  }

  async function handleAddToNetwork(alumniId: string) {
    setAddingId(alumniId)
    try {
      const { error } = await supabase.from('user_networks').insert({ user_id: userId, alumni_id: alumniId })
      if (error && error.code !== '23505') throw error // ignore "already in network"
      setNetworkIds((prev) => new Set([...prev, alumniId]))
      trackEvent('alumni_added_to_network', { alumni_id: alumniId, source: 'search' })
    } catch (e) {
      console.error('add to network failed', e)
    } finally {
      setAddingId(null)
    }
  }

  const inputBar = (
    // Ghost-text refinements are a NARROWING aid — only offered on follow-up
    // turns, not the first/landing search (which has the example cards).
    // lastQuery lets the follow-up placeholder propose a refinement of the
    // previous search instead of a generic example.
    <InputBar
      value={input}
      onChange={setInput}
      onSubmit={() => send(input)}
      busy={busy}
      profile={profile}
      allowSuggestions={active}
      lastQuery={turns.length ? turns[turns.length - 1].query : ''}
      autoFocus
    />
  )

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] max-w-2xl mx-auto px-4">
      {active ? (
        <>
          {/* Slim header keeps Clear reachable during a conversation */}
          <div className="flex items-center justify-end py-2.5">
            <button
              onClick={clearChat}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm text-[--text-quaternary] hover:text-[--text-primary] transition-colors disabled:opacity-40"
              title="Clear this conversation"
            >
              <Trash2 size={14} /><span className="hidden sm:inline">Clear</span>
            </button>
          </div>

          {/* Conversation scrolls; input stays pinned at the bottom */}
          <div className="flex-1 overflow-y-auto space-y-8 pb-4">
            {turns.map((turn) => (
              <TurnView
                key={turn.id}
                turn={turn}
                networkIds={networkIds}
                addingId={addingId}
                onAdd={handleAddToNetwork}
                onView={(a) => setDetail(a)}
                onRefine={(query, overrides) => send(query, 'suggestion', overrides)}
                onRetry={(query) => send(query, 'typed')}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 pt-2 pb-4">{inputBar}</div>
        </>
      ) : (
        /* Landing — greeting, input, and suggestions centered, Claude-style */
        <div className="flex-1 flex flex-col items-center justify-center pb-16">
          <div className="w-full max-w-xl text-center">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[--text-primary]">
              Hey, {firstName}
            </h1>
            <p className="text-[--text-tertiary] text-base mt-2.5">
              Describe the kind of alum you&apos;re looking for.
            </p>

            <div className="mt-8">{inputBar}</div>

            <div className="mt-4 grid sm:grid-cols-2 gap-2.5 text-left">
              {(suggestions?.length ? suggestions : EXAMPLES).map((ex) => (
                <button
                  key={ex}
                  onClick={() => send(ex, 'example')}
                  className="text-sm leading-relaxed px-4 py-3 rounded-2xl bg-[--bg-secondary] border border-[--border-primary] text-[--text-secondary] hover:border-[--border-secondary] hover:text-[--text-primary] transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {detail && (
        <AlumniDetailModal
          alumni={detail}
          isInNetwork={networkIds.has(detail.id)}
          networkIds={networkIds}
          onAddToNetwork={handleAddToNetwork}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

// Instant, profile-based refinement phrase used to build the follow-up
// placeholder. Given the PREVIOUS query, returns the next best refinement (or
// null). Priority: their preferred location → their sport → recent grads → top
// firms; each is skipped if the query already covers that dimension, so the
// hint is always something new to add.
function suggestRefinement(text: string, profile: Profile): string | null {
  const t = text.trim()
  if (t.length < 2) return null
  const lower = t.toLowerCase()
  const has = (s: string) => lower.includes(s.toLowerCase())

  const loc = profile.preferred_locations?.[0]
  if (loc && !has(' in ') && !has(loc)) return `in ${loc}`

  if (profile.sport && !has(profile.sport) && !has('played') && !has('sport')) {
    return `who played ${profile.sport}`
  }

  if (!has('recent') && !has('grad') && !has('junior') && !has('senior') && !has('class of')) {
    return 'who are recent grads'
  }

  if (!has('firm') && !has('top ')) return 'at top firms'

  return null
}

// ── Input box — same component whether centered (landing) or pinned (chat) ──
function InputBar({
  value, onChange, onSubmit, busy, profile, allowSuggestions, lastQuery, autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  busy: boolean
  profile: Profile
  allowSuggestions: boolean
  lastQuery: string
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])

  // The faded "ghost" suggestion is just the native placeholder — it shows
  // while the box is empty and disappears the instant the user types. No
  // inline autocomplete (that drifted out of alignment and produced broken
  // phrases like "who played in New York"). On a follow-up the placeholder
  // proposes a refinement of the PREVIOUS query; on the first search it's a
  // simple opener.
  const refineHint = allowSuggestions && lastQuery ? suggestRefinement(lastQuery, profile) : null
  const placeholder = allowSuggestions
    ? (refineHint ? `e.g. ${refineHint}` : 'Refine with a city, company, or seniority')
    : 'e.g. someone who works in tech'

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px` }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() } }}
        placeholder={placeholder}
        rows={1}
        disabled={busy}
        className="w-full resize-none rounded-2xl border border-[--border-primary] bg-[--bg-secondary] py-4 pl-5 pr-14 text-[15px] leading-relaxed text-[--text-primary] placeholder:text-[--text-quaternary] shadow-sm transition focus:outline-none focus:border-[--school-primary] focus:ring-4 focus:ring-[--school-primary]/15"
      />
      <button
        onClick={onSubmit}
        disabled={!value.trim() || busy}
        aria-label="Search"
        className="absolute right-2.5 bottom-2.5 w-10 h-10 rounded-xl bg-[--school-primary] text-white flex items-center justify-center shadow-sm transition hover:opacity-90 disabled:opacity-30"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
      </button>
    </div>
  )
}

// ── One turn: the query, then its result below ─────────────────────────────
function TurnView({
  turn, networkIds, addingId, onAdd, onView, onRefine, onRetry,
}: {
  turn: Turn
  networkIds: Set<string>
  addingId: string | null
  onAdd: (id: string) => void
  onView: (a: AlumniBase) => void
  onRefine: (query: string, overrides: { dropLocation?: boolean; broadenRole?: boolean }) => void
  onRetry: (query: string) => void
}) {
  return (
    <div className="space-y-3">
      {/* The query, right-aligned bubble */}
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-[--text-primary] text-[--bg-primary] rounded-2xl px-4 py-2 text-sm">
          {turn.query}
        </div>
      </div>

      {turn.status === 'pending' && (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      )}
      {turn.status === 'error' && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-[--text-quaternary] italic">{turn.errorText}</p>
          <button
            onClick={() => onRetry(turn.query)}
            className="text-xs px-3 py-1.5 rounded-full border border-[--border-primary] text-[--text-secondary] hover:border-[--border-secondary] shrink-0"
          >
            Try again
          </button>
        </div>
      )}

      {turn.status === 'done' && (
        <>
          {turn.intentSummary && <p className="text-sm text-[--text-quaternary] italic">{turn.intentSummary}</p>}
          {turn.clarifyingQuestion && <p className="text-[--text-primary]">{turn.clarifyingQuestion}</p>}

          {(turn.matches ?? []).map(({ alumnus, reasoning }) => {
            const inNetwork = networkIds.has(alumnus.id)
            return (
              <div key={alumnus.id} className="bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-4 transition-colors hover:border-[--border-secondary]">
                <div className="flex items-start gap-3">
                  <SportAvatar name={alumnus.full_name} sport={alumnus.sport} imageUrl={alumnus.avatar_url || alumnus.photo_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[--text-primary] truncate">{alumnus.full_name}</div>
                    <div className="text-sm text-[--text-tertiary] truncate">
                      {[alumnus.role, alumnus.company].filter(Boolean).join(' @ ') || alumnus.industry || 'Alumni'}
                    </div>
                    <div className="text-xs text-[--text-quaternary] mt-0.5">
                      {[alumnus.sport && alumnus.graduation_year ? `${alumnus.sport} '${String(alumnus.graduation_year).slice(-2)}` : null, alumnus.location]
                        .filter(Boolean).join('  ·  ')}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[--border-primary]">
                  <div className="text-[10px] font-semibold tracking-wider text-[--text-quaternary] uppercase mb-1">Why this match</div>
                  <p className="text-sm text-[--text-secondary] leading-relaxed">{reasoning}</p>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => onView(alumnus as AlumniBase)} className="btn-secondary text-sm">View profile</button>
                  {inNetwork ? (
                    <span className="btn-success text-sm flex items-center gap-1.5 cursor-default"><Check size={14} />In Network</span>
                  ) : (
                    <button onClick={() => onAdd(alumnus.id)} disabled={addingId === alumnus.id} className="btn-ghost text-sm flex items-center gap-1.5">
                      {addingId === alumnus.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Save
                    </button>
                  )}
                  {alumnus.linkedin_url && (
                    <a href={alumnus.linkedin_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm flex items-center gap-1.5 hover:text-[#0077b5] ml-auto">
                      <Linkedin size={14} /><span className="hidden sm:inline">LinkedIn</span>
                    </a>
                  )}
                </div>
              </div>
            )
          })}

          {(turn.matches?.length ?? 0) === 0 && turn.noMatchesReason && (
            <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-4">
              <p className="text-sm text-[--text-secondary]">{turn.noMatchesReason}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => onRefine(turn.query, { broadenRole: true })} className="text-xs px-3 py-1.5 rounded-full border border-[--border-primary] text-[--text-secondary] hover:border-[--border-secondary]">Broaden role</button>
                <button onClick={() => onRefine(turn.query, { dropLocation: true })} className="text-xs px-3 py-1.5 rounded-full border border-[--border-primary] text-[--text-secondary] hover:border-[--border-secondary]">Drop location</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[--bg-tertiary]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 bg-[--bg-tertiary] rounded" />
          <div className="h-3 w-2/3 bg-[--bg-tertiary] rounded" />
        </div>
      </div>
      <div className="h-3 w-full bg-[--bg-tertiary] rounded mt-4" />
    </div>
  )
}

function buildIntentSummary(r: SearchResponse): string | null {
  const parts: string[] = []
  if (r.intent.soft.roles.length) parts.push(r.intent.soft.roles.join(', '))
  if (r.intent.soft.industries.length) parts.push(`in ${r.intent.soft.industries.join(', ')}`)
  if (r.intent.hard.location) parts.push(`(${r.intent.hard.location})`)
  else if (r.intent.soft.locations.length) parts.push(`(${r.intent.soft.locations.join(', ')})`)
  if (r.intent.soft.themes.length) parts.push(`· ${r.intent.soft.themes[0]}`)
  if (r.intent.exclude?.length) parts.push(`· excluding ${r.intent.exclude.join(', ')}`)
  return parts.length ? `Looking for ${parts.join(' ')}` : null
}
