/**
 * Sport Name Normalization Module
 *
 * Normalizes free-text sport name variants into canonical Cornell sport
 * entries using fuzzy matching. Collapses variations like "Men's Basketball",
 * "M. Basketball", "Basketball - Men" into a single canonical entry with
 * category, contact type, and competition level metadata.
 */

// ---------------------------------------------------------------------------
// Canonical sport catalog
// ---------------------------------------------------------------------------

export interface NormalizedSportEntry {
  canonicalName: string
  aliases: string[]
  category: 'team' | 'individual'
  contactType: 'contact' | 'non-contact'
  level: 'varsity' | 'club' | 'intramural'
}

/**
 * The canonical Cornell sport list — covers all varsity, club, and
 * intramural offerings with known aliases for fuzzy matching.
 */
export const CANONICAL_SPORTS: NormalizedSportEntry[] = [
  // ── Team / Contact ──────────────────────────────────────────────────
  { canonicalName: 'Football',              aliases: ['football', 'cornell football', 'big red football'],                                        category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: 'Baseball',              aliases: ['baseball', 'cornell baseball', 'big red baseball'],                                        category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: 'Softball',              aliases: ['softball', 'cornell softball', 'big red softball'],                                        category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: 'Wrestling',             aliases: ['wrestling', 'cornell wrestling', 'big red wrestling', 'mens wrestling'],                  category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: "Men's Ice Hockey",      aliases: ['mens ice hockey', 'mens hockey', "men's hockey", 'm hockey', 'hockey - men', 'hockey', 'ice hockey', 'cornell hockey', 'big red hockey', 'mens ice hockey', 'm ice hockey'], category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: "Women's Ice Hockey",    aliases: ['womens ice hockey', 'womens hockey', "women's hockey", 'w hockey', 'hockey - women', 'cornell womens hockey', 'womens ice hockey'],             category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: "Men's Lacrosse",        aliases: ['mens lacrosse', "men's lacrosse", 'm lacrosse', 'lacrosse - men', 'lacrosse mens', 'cornell lacrosse'],                                                category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: "Women's Lacrosse",      aliases: ['womens lacrosse', "women's lacrosse", 'w lacrosse', 'lacrosse - women', 'lacrosse womens', 'cornell womens lacrosse'],                                category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: "Men's Soccer",          aliases: ['mens soccer', "men's soccer", 'm soccer', 'soccer - men', 'soccer mens', 'cornell soccer'],                                                            category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: "Women's Soccer",        aliases: ['womens soccer', "women's soccer", 'w soccer', 'soccer - women', 'soccer womens', 'cornell womens soccer'],                                            category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: "Men's Basketball",      aliases: ['mens basketball', "men's basketball", 'm basketball', 'basketball - men', 'basketball mens', 'mens bball', 'basketball', 'cornell basketball', 'cornell mens basketball', 'm bball'], category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: "Women's Basketball",    aliases: ['womens basketball', "women's basketball", 'w basketball', 'basketball - women', 'basketball womens', 'womens bball', 'cornell womens basketball', 'w bball'], category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: "Men's Polo",            aliases: ['mens polo', "men's polo", 'm polo', 'polo - men', 'polo', 'cornell polo'],                                                                          category: 'team', contactType: 'contact', level: 'varsity' },
  { canonicalName: "Women's Polo",          aliases: ['womens polo', "women's polo", 'w polo', 'polo - women'],                                                                                              category: 'team', contactType: 'contact', level: 'varsity' },

  // ── Team / Non-Contact ──────────────────────────────────────────────
  { canonicalName: "Men's Squash",          aliases: ['mens squash', "men's squash", 'm squash', 'squash', 'squash - men', 'cornell squash'],                                                              category: 'team', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Women's Squash",        aliases: ['womens squash', "women's squash", 'w squash', 'squash - women', 'cornell womens squash'],                                                            category: 'team', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Women's Volleyball",    aliases: ['womens volleyball', "women's volleyball", 'w volleyball', 'volleyball - women', 'volleyball womens', 'cornell volleyball', 'cornell womens volleyball'], category: 'team', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Men's Volleyball",      aliases: ['mens volleyball', "men's volleyball", 'm volleyball', 'volleyball - men', 'volleyball mens'],                                                          category: 'team', contactType: 'non-contact', level: 'club' },
  { canonicalName: 'Field Hockey',          aliases: ['field hockey', 'cornell field hockey'],                                                                                                              category: 'team', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Women's Gymnastics",    aliases: ['womens gymnastics', "women's gymnastics", 'gymnastics', 'cornell gymnastics', 'cornell womens gymnastics'],                                          category: 'team', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Women's Sailing",       aliases: ['womens sailing', "women's sailing", 'sailing', 'cornell sailing', 'sailing - women'],                                                                category: 'team', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Men's Rowing",          aliases: ['mens rowing', "men's rowing", 'm rowing', 'rowing - men', 'rowing mens', 'rowing', 'cornell rowing', 'crew', 'mens crew'],                          category: 'team', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Women's Rowing",        aliases: ['womens rowing', "women's rowing", 'w rowing', 'rowing - women', 'rowing womens', 'cornell womens rowing', 'womens crew', 'w crew'],                 category: 'team', contactType: 'non-contact', level: 'varsity' },

  // ── Individual / Non-Contact ────────────────────────────────────────
  { canonicalName: "Men's Track & Field",         aliases: ['mens track & field', "men's track & field", 'mens track and field', "men's track and field", 'm track', 'track & field - men', 'track', 'track and field', 'cornell track', 'men track & field'], category: 'individual', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Women's Track & Field",       aliases: ['womens track & field', "women's track & field", 'womens track and field', "women's track and field", 'w track', 'track & field - women', 'cornell womens track'], category: 'individual', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Men's Cross Country",         aliases: ['mens cross country', "men's cross country", 'm cross country', 'cross country', 'cross country - men', 'cornell cross country', 'xc', 'mens xc'], category: 'individual', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Women's Cross Country",       aliases: ['womens cross country', "women's cross country", 'w cross country', 'cross country - women', 'cornell womens cross country', 'womens xc', 'w xc'], category: 'individual', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Men's Tennis",                aliases: ['mens tennis', "men's tennis", 'm tennis', 'tennis', 'tennis - men', 'tennis mens', 'cornell tennis', 'cornell mens tennis'],                    category: 'individual', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Women's Tennis",              aliases: ['womens tennis', "women's tennis", 'w tennis', 'tennis - women', 'tennis womens', 'cornell womens tennis'],                                      category: 'individual', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Men's Golf",                  aliases: ['mens golf', "men's golf", 'm golf', 'golf', 'golf - men', 'cornell golf', 'cornell mens golf'],                                                  category: 'individual', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Men's Swimming & Diving",     aliases: ['mens swimming & diving', "men's swimming & diving", 'mens swimming and diving', "men's swimming and diving", 'm swimming', 'swimming', 'swimming & diving', 'swimming and diving', 'cornell swimming', 'mens swim'], category: 'individual', contactType: 'non-contact', level: 'varsity' },
  { canonicalName: "Women's Swimming & Diving",   aliases: ['womens swimming & diving', "women's swimming & diving", 'womens swimming and diving', "women's swimming and diving", 'w swimming', 'swimming - women', 'cornell womens swimming', 'womens swim'], category: 'individual', contactType: 'non-contact', level: 'varsity' },

  // ── Individual / Contact ────────────────────────────────────────────
  { canonicalName: "Men's Fencing",         aliases: ['mens fencing', "men's fencing", 'fencing - men', 'cornell mens fencing'],                                                                          category: 'individual', contactType: 'contact', level: 'varsity' },
  { canonicalName: "Women's Fencing",       aliases: ['womens fencing', "women's fencing", 'fencing', 'fencing - women', 'cornell fencing', 'cornell womens fencing'],                                    category: 'individual', contactType: 'contact', level: 'varsity' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Common prefixes and suffixes to strip for improved matching. */
const REMOVAL_PATTERNS = [
  /^cornell\s+/i,
  /^big red\s+/i,
  /\s+-+\s+.+/i, // "Basketball - Men" → "Basketball"
  /\s+-\s+.+/i,
  /\s+\(.+\)/g,  // "Basketball (Men)" → "Basketball"
  /\b(team|program|club|varsity)\b/i,
]

/** Normalize a raw sport name: lowercase + trim + strip patterns + collapse whitespace. */
export function cleanSportName(raw: string): string {
  let name = raw
    .trim()
    .toLowerCase()
    .replace(/[.,#!$%&*;:{}=\-_`~()'\"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Strip known prefixes/suffixes
  for (const pattern of REMOVAL_PATTERNS) {
    name = name.replace(pattern, '').trim()
  }

  // Normalize "&" to "and"
  name = name.replace(/ & /g, ' and ')

  // Collapse multiple spaces
  name = name.replace(/\s+/g, ' ').trim()

  return name
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export interface NormalizationResult {
  canonicalName: string
  category: 'team' | 'individual'
  contactType: 'contact' | 'non-contact'
  level: 'varsity' | 'club' | 'intramural'
  confidence: number // 0.0–1.0 (1.0 = exact alias match, lower = partial)
}

/** Normalize "men" / "mens" / "women" / "womens" → "men's" / "women's" */
function normalizeGenderPrefix(raw: string): string {
  return raw
    .replace(/\bmens?\b/gi, "men's")
    .replace(/\bwomens?\b/gi, "women's")
}

/**
 * Normalize a free-text sport name to a canonical entry.
 *
 * Strategy:
 *  1. Clean the raw name (lowercase, strip prefixes, collapse whitespace).
 *  2. Normalize gender prefixes (mens → men's, womens → women's).
 *  3. Check the cleaned name against all known aliases (exact match).
 *  4. If no match, check substring/partial matching.
 *  5. Fallback: return raw name trimmed.
 */
export function normalizeSport(rawName: string): NormalizationResult {
  if (!rawName || !rawName.trim()) {
    return { canonicalName: rawName || '', category: 'team', contactType: 'non-contact', level: 'varsity', confidence: 0 }
  }

  const cleaned = cleanSportName(rawName)
  if (!cleaned) {
    return { canonicalName: rawName.trim(), category: 'team', contactType: 'non-contact', level: 'varsity', confidence: 0 }
  }

  // Normalize gender prefixes before matching
  const gendered = normalizeGenderPrefix(cleaned)

  const cleanAlias = (s: string) => normalizeGenderPrefix(cleanSportName(s))

  // Pass 1: exact match against aliases and canonical names
  for (const entry of CANONICAL_SPORTS) {
    const cleanCanonical = cleanAlias(entry.canonicalName)
    if (gendered === cleanCanonical) {
      return { canonicalName: entry.canonicalName, category: entry.category, contactType: entry.contactType, level: entry.level, confidence: 1.0 }
    }

    for (const alias of entry.aliases) {
      if (gendered === cleanAlias(alias)) {
        return { canonicalName: entry.canonicalName, category: entry.category, contactType: entry.contactType, level: entry.level, confidence: 1.0 }
      }
    }
  }

  // Pass 2: substring / partial matching
  let bestMatch: { entry: NormalizedSportEntry; score: number } | null = null

  for (const entry of CANONICAL_SPORTS) {
    const cleanCanonical = cleanAlias(entry.canonicalName)
    const scoreCanonical = substringScore(gendered, cleanCanonical)
    if (scoreCanonical > 0) {
      if (!bestMatch || scoreCanonical > bestMatch.score) {
        bestMatch = { entry, score: scoreCanonical }
      }
    }

    for (const alias of entry.aliases) {
      const scoreAlias = substringScore(gendered, cleanAlias(alias))
      if (scoreAlias > 0) {
        if (!bestMatch || scoreAlias > bestMatch.score) {
          bestMatch = { entry, score: scoreAlias }
        }
      }
    }
  }

  if (bestMatch && bestMatch.score >= 0.6) {
    return {
      canonicalName: bestMatch.entry.canonicalName,
      category: bestMatch.entry.category,
      contactType: bestMatch.entry.contactType,
      level: bestMatch.entry.level,
      confidence: bestMatch.score,
    }
  }

  // Fallback
  return { canonicalName: rawName.trim(), category: 'team', contactType: 'non-contact', level: 'varsity', confidence: 0 }
}

/**
 * Compute a simple substring-based similarity score between two strings.
 * Returns 0.0–1.0 where:
 *   - 1.0 = exact match
 *   - 0.8 = one contains the other
 *   - 0.6 = significant overlap (one is a prefix of the other)
 *   - 0.0 = no meaningful match
 */
function substringScore(a: string, b: string): number {
  if (a === b) return 1.0
  if (a.length === 0 || b.length === 0) return 0

  // One is fully contained in the other
  if (a.includes(b) || b.includes(a)) {
    const longer = a.length >= b.length ? a : b
    const shorter = a.length < b.length ? a : b
    const ratio = shorter.length / longer.length
    return Math.min(0.9, 0.5 + ratio * 0.4)
  }

  // Check if one is a prefix of the other
  if (a.startsWith(b) || b.startsWith(a)) {
    return 0.7
  }

  // Check significant word overlap
  const wordsA = a.split(' ')
  const wordsB = b.split(' ')
  const intersection = wordsA.filter((w) => wordsB.includes(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  if (union > 0) {
    const jaccard = intersection / union
    if (jaccard >= 0.5) return 0.5 + jaccard * 0.3
  }

  return 0
}

/**
 * Return a flat map of all known aliases → canonical name for quick lookups.
 */
export function buildSportAliasMap(): Map<string, NormalizedSportEntry> {
  const map = new Map<string, NormalizedSportEntry>()
  for (const entry of CANONICAL_SPORTS) {
    const cleanC = normalizeGenderPrefix(cleanSportName(entry.canonicalName))
    map.set(cleanC, entry)
    for (const alias of entry.aliases) {
      map.set(normalizeGenderPrefix(cleanSportName(alias)), entry)
    }
  }
  return map
}

/**
 * Get all distinct canonical sport names.
 */
export function getCanonicalSportNames(): string[] {
  return CANONICAL_SPORTS.map((e) => e.canonicalName)
}

/**
 * Find unmapped sport names from a given set of values (e.g. alumni.sport values).
 * Returns values that don't match any canonical sport.
 */
export function findUnmappedSports(values: string[]): string[] {
  const mapped = new Set<string>()
  for (const v of values) {
    const result = normalizeSport(v)
    if (result.confidence < 0.6) {
      mapped.add(v)
    }
  }
  return Array.from(mapped)
}
