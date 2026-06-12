import type { Dataset } from '../data'
import type { Filters } from '../types'
import { useAppDispatch } from '../state'

interface Story {
  emoji: string
  title: string
  blurb: string
  patch: (ds: Dataset) => Partial<Filters> | null
}

const STORIES: Story[] = [
  {
    emoji: '⚾',
    title: "The '80s baseball crews",
    blurb: 'Browse the roster era, open anyone, see who they played with.',
    patch: ds => {
      const i = ds.data.sports.indexOf('Baseball')
      return i < 0 ? null : { sports: [i], years: [1980, 1989] }
    },
  },
  {
    emoji: '🏒',
    title: 'Hockey alumni in finance',
    blurb: 'Two filters stacked — sport plus industry.',
    patch: ds => {
      const sp = ds.data.sports.map((s, i) => (/ice hockey/i.test(s) ? i : -1)).filter(i => i >= 0)
      const fin = ds.data.industries.indexOf('Finance')
      return sp.length && fin >= 0 ? { sports: sp, industries: [fin] } : null
    },
  },
  {
    emoji: '🗽',
    title: 'Everyone within an hour of NYC',
    blurb: 'A geographic lens — works with any other filter.',
    patch: () => ({ near: { label: 'NYC', lng: -74.006, lat: 40.7128, km: 60 } }),
  },
]

export default function WelcomePanel({ ds }: { ds: Dataset }) {
  const dispatch = useAppDispatch()
  const { stats, sports } = ds.data

  return (
    <aside className="welcome-panel" aria-label="How this works">
      <h2>Find the athletes who came before you.</h2>
      <p className="welcome-sub">
        {stats.total.toLocaleString()} Cornell athlete alumni · {sports.length} sports · classes
        of {stats.yearMin}–{stats.yearMax}
      </p>

      <ol className="welcome-steps">
        <li><strong>Search or browse.</strong> A name, a team, an era, a city, an industry — half-remembered names are fine.</li>
        <li><strong>Open a profile.</strong> See their career, and everyone they played with, season by season.</li>
        <li><strong>Work the circle.</strong> Put their teammates on the map, keep your own filters on, and find the warm path in.</li>
      </ol>

      <h3>Try a story</h3>
      <div className="story-list">
        {STORIES.map(s => {
          const patch = s.patch(ds)
          if (!patch) return null
          return (
            <button
              key={s.title}
              className="story-card"
              onClick={() => dispatch({ type: 'patchFilters', patch })}
            >
              <span className="story-emoji" aria-hidden="true">{s.emoji}</span>
              <span className="story-body">
                <span className="story-title">{s.title}</span>
                <span className="story-blurb">{s.blurb}</span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="welcome-foot muted">
        Heard about a legendary team but only remember one name? Search it, open the profile,
        hit <em>Teammates on map</em> — that's the whole crew.
      </p>
    </aside>
  )
}
