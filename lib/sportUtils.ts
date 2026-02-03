/**
 * Sport Utilities
 * Provides exact matching for sports to prevent cross-matching between distinct teams.
 *
 * Examples of teams that should NOT match each other:
 * - Men's Basketball ≠ Women's Basketball
 * - Football ≠ Sprint Football
 * - Men's Soccer ≠ Women's Soccer
 */

// Complete list of Cornell varsity sports with exact team names
export const SPORTS_LIST = [
  'Baseball',
  'Equestrian',
  'Fencing',
  'Field Hockey',
  'Football',
  "Men's Basketball",
  "Men's Cross Country",
  "Men's Golf",
  "Men's Ice Hockey",
  "Men's Lacrosse",
  "Men's Rowing",
  "Men's Soccer",
  "Men's Squash",
  "Men's Swimming And Diving",
  "Men's Tennis",
  "Men's Track And Field",
  'Rowing',
  'Softball',
  'Sprint Football',
  "Women's Basketball",
  "Women's Cross Country",
  "Women's Gymnastics",
  "Women's Ice Hockey",
  "Women's Lacrosse",
  "Women's Rowing",
  "Women's Sailing",
  "Women's Soccer",
  "Women's Squash",
  "Women's Swimming And Diving",
  "Women's Tennis",
  "Women's Track And Field",
  "Women's Volleyball",
  'Wrestling',
] as const

export type Sport = typeof SPORTS_LIST[number]

/**
 * Checks if an alumni's sport exactly matches the filter sport (case-insensitive).
 * Uses strict equality - no partial matching.
 *
 * @param alumniSport - The sport from the alumni profile
 * @param filterSport - The sport being filtered for
 * @returns true if the sports match exactly (case-insensitive)
 */
export function sportMatchesExact(alumniSport: string | null | undefined, filterSport: string | null): boolean {
  if (!filterSport) return true // No filter means show all
  if (!alumniSport) return false // Alumni has no sport, can't match filter

  return alumniSport.toLowerCase().trim() === filterSport.toLowerCase().trim()
}

/**
 * Normalizes a sport name to the official Cornell team name format.
 * Used to help users migrate from generic sport names to exact team names.
 *
 * @param sport - A potentially generic sport name
 * @returns The exact sport name if found, or the original if no match
 */
export function normalizeSportName(sport: string): string {
  const sportLower = sport.toLowerCase().trim()

  // Find exact match first (case-insensitive)
  const exactMatch = SPORTS_LIST.find(s => s.toLowerCase() === sportLower)
  if (exactMatch) return exactMatch

  // No normalization - return original to preserve data
  return sport
}

/**
 * Checks if a sport name is a generic name that should be updated to a specific team name.
 *
 * Generic sports that need to be specified:
 * - Basketball → Men's Basketball or Women's Basketball
 * - Soccer → Men's Soccer or Women's Soccer
 * - Lacrosse → Men's Lacrosse or Women's Lacrosse
 * - Tennis → Men's Tennis or Women's Tennis
 * - etc.
 */
export function isGenericSport(sport: string): boolean {
  const genericSports = [
    'basketball',
    'soccer',
    'lacrosse',
    'tennis',
    'squash',
    'rowing',
    'swimming',
    'swimming and diving',
    'cross country',
    'track',
    'track and field',
    'ice hockey',
    'hockey',
    'golf',
    'volleyball',
    'gymnastics',
  ]

  return genericSports.includes(sport.toLowerCase().trim())
}

/**
 * Gets possible specific team names for a generic sport.
 *
 * @param genericSport - A generic sport name like "Basketball"
 * @returns Array of specific team names like ["Men's Basketball", "Women's Basketball"]
 */
export function getSpecificSportOptions(genericSport: string): string[] {
  const sportLower = genericSport.toLowerCase().trim()

  const sportMap: Record<string, string[]> = {
    'basketball': ["Men's Basketball", "Women's Basketball"],
    'soccer': ["Men's Soccer", "Women's Soccer"],
    'lacrosse': ["Men's Lacrosse", "Women's Lacrosse"],
    'tennis': ["Men's Tennis", "Women's Tennis"],
    'squash': ["Men's Squash", "Women's Squash"],
    'rowing': ["Men's Rowing", "Women's Rowing", "Rowing"],
    'swimming': ["Men's Swimming And Diving", "Women's Swimming And Diving"],
    'swimming and diving': ["Men's Swimming And Diving", "Women's Swimming And Diving"],
    'cross country': ["Men's Cross Country", "Women's Cross Country"],
    'track': ["Men's Track And Field", "Women's Track And Field"],
    'track and field': ["Men's Track And Field", "Women's Track And Field"],
    'ice hockey': ["Men's Ice Hockey", "Women's Ice Hockey"],
    'hockey': ["Men's Ice Hockey", "Women's Ice Hockey", "Field Hockey"],
    'golf': ["Men's Golf"],
    'volleyball': ["Women's Volleyball"],
    'gymnastics': ["Women's Gymnastics"],
  }

  return sportMap[sportLower] || []
}
