/**
 * Company Name Normalization Module
 *
 * Normalizes free-text company names into canonical entries using
 * lightweight fuzzy matching. Collapses variations like "Citi",
 * "Citigroup", and "Citigroup Inc" into a single canonical entity
 * with an industry category.
 */

import type { IndustryCategory } from '@scout/shared/types/database'

// ---------------------------------------------------------------------------
// Canonical company catalog
// ---------------------------------------------------------------------------

export interface CanonicalEntry {
  canonicalName: string
  aliases: string[]
  industry: IndustryCategory
}

/**
 * The canonical company list — at minimum 30 entries covering banking,
 * consulting, tech, law, medicine, sports, and beyond.
 */
export const CANONICAL_COMPANIES: CanonicalEntry[] = [
  // ── Banking / Finance ────────────────────────────────────────────────
  { canonicalName: 'Goldman Sachs',        aliases: ['goldman sachs', 'goldman', 'gs'],                                        industry: 'Finance' },
  { canonicalName: 'JPMorgan Chase',       aliases: ['jpmorgan chase', 'jpmorgan', 'jp morgan', 'jpmc', 'chase'],              industry: 'Finance' },
  { canonicalName: 'Morgan Stanley',       aliases: ['morgan stanley', 'ms'],                                                  industry: 'Finance' },
  { canonicalName: 'Citigroup',            aliases: ['citigroup', 'citi', 'citibank'],                                         industry: 'Finance' },
  { canonicalName: 'Bank of America',      aliases: ['bank of america', 'bofa', 'baml', 'merrill lynch'],                     industry: 'Finance' },
  { canonicalName: 'Wells Fargo',          aliases: ['wells fargo', 'wells fargo & co'],                                       industry: 'Finance' },
  { canonicalName: 'UBS',                  aliases: ['ubs', 'union bank of switzerland'],                                      industry: 'Finance' },
  { canonicalName: 'Credit Suisse',        aliases: ['credit suisse', 'credit suisse group'],                                  industry: 'Finance' },
  { canonicalName: 'BlackRock',            aliases: ['blackrock', 'black rock'],                                                industry: 'Finance' },
  { canonicalName: 'Blackstone',           aliases: ['blackstone', 'blackstone group'],                                        industry: 'Finance' },

  // ── Consulting ───────────────────────────────────────────────────────
  { canonicalName: 'McKinsey & Company',   aliases: ['mckinsey', 'mckinsey & company', 'mckinsey and company'],                industry: 'Consulting' },
  { canonicalName: 'Boston Consulting Group', aliases: ['boston consulting group', 'bcg', 'bcg group'],                          industry: 'Consulting' },
  { canonicalName: 'Bain & Company',       aliases: ['bain', 'bain & company', 'bain and company'],                            industry: 'Consulting' },
  { canonicalName: 'Deloitte',             aliases: ['deloitte', 'deloitte & touche', 'deloitte and touche', 'deloitte consulting'], industry: 'Consulting' },
  { canonicalName: 'PwC',                  aliases: ['pwc', 'pricewaterhousecoopers', 'price waterhouse coopers'],              industry: 'Consulting' },
  { canonicalName: 'Ernst & Young',        aliases: ['ernst & young', 'ernst and young', 'ey'],                                 industry: 'Consulting' },
  { canonicalName: 'KPMG',                 aliases: ['kpmg', 'kpmg llp'],                                                       industry: 'Consulting' },
  { canonicalName: 'Accenture',            aliases: ['accenture', 'accenture plc'],                                             industry: 'Consulting' },

  // ── Technology ───────────────────────────────────────────────────────
  { canonicalName: 'Google',               aliases: ['google', 'alphabet'],                                                     industry: 'Technology' },
  { canonicalName: 'Meta',                 aliases: ['meta', 'facebook', 'meta platforms'],                                    industry: 'Technology' },
  { canonicalName: 'Apple',                aliases: ['apple', 'apple inc'],                                                     industry: 'Technology' },
  { canonicalName: 'Microsoft',            aliases: ['microsoft', 'microsoft corporation', 'msft'],                             industry: 'Technology' },
  { canonicalName: 'Amazon',               aliases: ['amazon', 'amazon web services', 'aws'],                                   industry: 'Technology' },
  { canonicalName: 'Netflix',              aliases: ['netflix', 'netflix inc'],                                                 industry: 'Technology' },
  { canonicalName: 'Tesla',                aliases: ['tesla', 'tesla inc', 'tesla motors'],                                    industry: 'Technology' },
  { canonicalName: 'NVIDIA',               aliases: ['nvidia', 'nvidia corporation'],                                          industry: 'Technology' },
  { canonicalName: 'OpenAI',               aliases: ['openai', 'open ai', 'openai lp'],                                        industry: 'Technology' },
  { canonicalName: 'Palantir Technologies', aliases: ['palantir', 'palantir technologies'],                                    industry: 'Technology' },

  // ── Law ──────────────────────────────────────────────────────────────
  { canonicalName: 'Skadden',              aliases: ['skadden', 'skadden arps', 'skadden arps slate meagher & flom'],           industry: 'Law' },
  { canonicalName: 'Latham & Watkins',     aliases: ['latham & watkins', 'latham and watkins', 'latham'],                      industry: 'Law' },
  { canonicalName: 'Kirkland & Ellis',     aliases: ['kirkland & ellis', 'kirkland and ellis', 'kirkland'],                     industry: 'Law' },

  // ── Medicine / Healthcare ────────────────────────────────────────────
  { canonicalName: 'Johnson & Johnson',    aliases: ['johnson & johnson', 'johnson and johnson', 'jnj'],                        industry: 'Medicine' },
  { canonicalName: 'Pfizer',               aliases: ['pfizer', 'pfizer inc'],                                                   industry: 'Medicine' },
  { canonicalName: 'UnitedHealth Group',   aliases: ['unitedhealth group', 'unitedhealth', 'uhg'],                              industry: 'Medicine' },
  { canonicalName: 'Mayo Clinic',          aliases: ['mayo clinic', 'mayo'],                                                    industry: 'Medicine' },
  { canonicalName: 'Cleveland Clinic',     aliases: ['cleveland clinic', 'ccf'],                                                industry: 'Medicine' },

  // ── Sports ───────────────────────────────────────────────────────────
  { canonicalName: 'Nike',                 aliases: ['nike', 'nike inc'],                                                       industry: 'Sports' },
  { canonicalName: 'Adidas',               aliases: ['adidas', 'adidas ag'],                                                    industry: 'Sports' },
  { canonicalName: 'ESPN',                 aliases: ['espn', 'entertainment and sports programming network'],                   industry: 'Sports' },
  { canonicalName: 'IMG',                  aliases: ['img', 'img college', 'img academy'],                                      industry: 'Sports' },

  // ── Education ────────────────────────────────────────────────────────
  { canonicalName: 'Cornell University',   aliases: ['cornell', 'cornell university', 'cornell univ'],                          industry: 'Education' },
  { canonicalName: 'Harvard University',   aliases: ['harvard', 'harvard university', 'harvard business school'],               industry: 'Education' },

  // ── Media ────────────────────────────────────────────────────────────
  { canonicalName: 'The New York Times',   aliases: ['the new york times', 'new york times', 'ny times', 'nyt'],                industry: 'Media' },
  { canonicalName: 'The Wall Street Journal', aliases: ['the wall street journal', 'wall street journal', 'wsj'],               industry: 'Media' },
  { canonicalName: 'Bloomberg',            aliases: ['bloomberg', 'bloomberg lp'],                                              industry: 'Media' },
  { canonicalName: 'Disney',               aliases: ['disney', 'the walt disney company', 'walt disney'],                       industry: 'Media' },

  // ── Real Estate ──────────────────────────────────────────────────────
  { canonicalName: 'CBRE Group',           aliases: ['cbre', 'cbre group'],                                                     industry: 'Real Estate' },
  { canonicalName: 'JLL',                  aliases: ['jll', 'jones lang lasalle', 'jones lang lasalle ip'],                    industry: 'Real Estate' },

  // ── Non-Profit ───────────────────────────────────────────────────────
  { canonicalName: 'Teach For America',    aliases: ['teach for america', 'tfa'],                                               industry: 'Non-Profit' },
  { canonicalName: 'Peace Corps',          aliases: ['peace corps', 'the peace corps'],                                         industry: 'Non-Profit' },

  // ── Government ───────────────────────────────────────────────────────
  { canonicalName: 'Federal Reserve Board', aliases: ['federal reserve', 'fed', 'federal reserve board', 'federal reserve system'], industry: 'Government' },
  { canonicalName: 'CIA',                   aliases: ['cia', 'central intelligence agency'],                                      industry: 'Government' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Common suffixes to strip for improved matching. */
const COMMON_SUFFIXES = [
  /\binc\.?$/i,
  /\bcorp\.?$/i,
  /\bllc\.?$/i,
  /\bltd\.?$/i,
  /\bco\.?$/i,
  /\b& co\.?$/i,
  /\band co\.?$/i,
  /\bgroup$/i,
  /\bplc\.?$/i,
  /\blp\.?$/i,
  /\bllp\.?$/i,
  /\bcorporation$/i,
  /\bcompanies$/i,
  /\bag\.?$/i,
  /\bgmbh$/i,
  /\bholdings$/i,
]

/** Normalize a raw company name: lowercase + trim + strip suffixes + collapse whitespace. */
export function cleanCompanyName(raw: string): string {
  let name = raw
    .trim()
    .toLowerCase()
    .replace(/[.,#!$%&*;:{}=\-_`~()'"]+/g, ' ') // replace punctuation with space
    .replace(/\s+/g, ' ')                           // collapse whitespace
    .trim()

  // Strip common suffixes
  for (const suffix of COMMON_SUFFIXES) {
    name = name.replace(suffix, '').trim()
  }

  return name
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export interface NormalizationResult {
  canonicalName: string
  industry: IndustryCategory
  confidence: number // 0.0–1.0 (1.0 = exact alias match, lower = fallback)
}

/**
 * Normalize a free-text company name to a canonical entry.
 *
 * Strategy:
 *  1. Clean the raw name (lowercase, strip suffixes, collapse whitespace).
 *  2. Check the cleaned name against all known aliases (exact match).
 *  3. If no match, check if the cleaned name is a substring of any alias
 *     or vice versa (for partials like "Citi" matching "citigroup").
 *  4. Fallback: return raw name with industry="Other".
 */
export function normalizeCompany(rawName: string): NormalizationResult {
  if (!rawName || !rawName.trim()) {
    return { canonicalName: rawName || '', industry: 'Other', confidence: 0 }
  }

  const cleaned = cleanCompanyName(rawName)

  if (!cleaned) {
    return { canonicalName: rawName.trim(), industry: 'Other', confidence: 0 }
  }

  // Pass 1: exact match against aliases and canonical names
  for (const entry of CANONICAL_COMPANIES) {
    const cleanCanonical = cleanCompanyName(entry.canonicalName)

    if (cleaned === cleanCanonical) {
      return { canonicalName: entry.canonicalName, industry: entry.industry, confidence: 1.0 }
    }

    for (const alias of entry.aliases) {
      const cleanAlias = cleanCompanyName(alias)
      if (cleaned === cleanAlias) {
        return { canonicalName: entry.canonicalName, industry: entry.industry, confidence: 1.0 }
      }
    }
  }

  // Pass 2: substring / partial matching
  let bestMatch: { entry: CanonicalEntry; score: number } | null = null

  for (const entry of CANONICAL_COMPANIES) {
    const cleanCanonical = cleanCompanyName(entry.canonicalName)

    // Check cleaned against canonical
    const scoreCanonical = substringScore(cleaned, cleanCanonical)
    if (scoreCanonical > 0) {
      if (!bestMatch || scoreCanonical > bestMatch.score) {
        bestMatch = { entry, score: scoreCanonical }
      }
    }

    // Check cleaned against each alias
    for (const alias of entry.aliases) {
      const cleanAlias = cleanCompanyName(alias)
      const scoreAlias = substringScore(cleaned, cleanAlias)
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
      industry: bestMatch.entry.industry,
      confidence: bestMatch.score,
    }
  }

  // Fallback
  return { canonicalName: rawName.trim(), industry: 'Other', confidence: 0 }
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
    // The more the shorter covers the longer, the better the match
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
export function buildAliasMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of CANONICAL_COMPANIES) {
    const cleanC = cleanCompanyName(entry.canonicalName)
    map.set(cleanC, entry.canonicalName)
    for (const alias of entry.aliases) {
      map.set(cleanCompanyName(alias), entry.canonicalName)
    }
  }
  return map
}
