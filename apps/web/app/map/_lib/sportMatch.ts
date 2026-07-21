import type { Dataset } from './data'

// profiles.sport is free-ish text: mobile onboarding writes generic names
// ("Soccer", "Track & Field"), web onboarding is a free-text input — expect
// curly apostrophes from iOS smart punctuation ("Men’s"), apostrophe-less
// prefixes ("Mens Soccer"), and "And" for "&".
const norm = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[‘’]/g, "'")
    .replace(/\bmens\b/g, "men's")
    .replace(/\bwomens\b/g, "women's")
    .replace(/\s+and\s+/g, ' & ')
    .replace(/\s+/g, ' ')

// Mobile onboarding names that differ from the dataset's family names. Plain
// "hockey" means ice hockey here — Field Hockey is its own onboarding option.
const ALIASES: Record<string, string> = {
  hockey: 'ice hockey',
  swimming: 'swimming & diving',
  diving: 'swimming & diving',
  track: 'track & field',
}

/**
 * Dataset sport indices for a student's profile sport. A gendered prefix
 * narrows to that gender; a generic name matches the whole family (both
 * gendered rosters plus any generic one). [] when null/empty/unmatched —
 * callers fall back to the search-first landing.
 */
export function sportIndicesFor(ds: Dataset, rawSport: string | null | undefined): number[] {
  if (!rawSport?.trim()) return []
  let name = norm(rawSport)

  let gender: 'm' | 'w' | null = null
  if (name.startsWith("men's ")) { gender = 'm'; name = name.slice(6) }
  else if (name.startsWith("women's ")) { gender = 'w'; name = name.slice(8) }
  name = ALIASES[name] ?? name

  const exact = ds.data.sports.findIndex(s => norm(s) === (gender ? `${gender === 'm' ? "men's" : "women's"} ${name}` : name))
  if (exact !== -1) return ds.compatibleSports[exact]

  const out: number[] = []
  ds.data.sportMeta.forEach((m, i) => {
    if (norm(m.f) === name && (gender == null || m.g == null || m.g === gender)) out.push(i)
  })
  return out
}
