/**
 * Company Name Normalization Library
 *
 * Uses fuzzy matching (Fuse.js) against a canonical company names list
 * to normalize raw company strings and auto-tag industry categories.
 *
 * The canonical list lives in apps/web/data/canonical-companies.json and
 * is loaded at import time.
 */

import Fuse from 'fuse.js'
import canonicalData from '@/data/canonical-companies.json'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanonicalCompany {
  canonical: string
  industry: string
  aliases: string[]
}

export interface NormalizationResult {
  canonicalName: string
  industry: string
  confidence: number   // 0 – 1
  matchedAlias: string | null
}

// ---------------------------------------------------------------------------
// Load canonical list
// ---------------------------------------------------------------------------

export const CANONICAL_COMPANIES: CanonicalCompany[] = canonicalData as CanonicalCompany[]

// ---------------------------------------------------------------------------
// Alias map (exact & prefix matching)
// ---------------------------------------------------------------------------

export interface AliasMapEntry {
  canonicalName: string
  industry: string
}

/**
 * Build a flat map from every alias → canonical entry.
 * Lowercased keys for case-insensitive lookup.
 */
export function buildAliasMap(): Map<string, AliasMapEntry> {
  const map = new Map<string, AliasMapEntry>()

  for (const entry of CANONICAL_COMPANIES) {
    const key = entry.canonical.toLowerCase().trim()
    if (!map.has(key)) {
      map.set(key, { canonicalName: entry.canonical, industry: entry.industry })
    }

    for (const alias of entry.aliases) {
      const aliasKey = alias.toLowerCase().trim()
      if (!map.has(aliasKey)) {
        map.set(aliasKey, { canonicalName: entry.canonical, industry: entry.industry })
      }
    }
  }

  return map
}

// ---------------------------------------------------------------------------
// Fuse.js instance (lazy)
// Build index over canonical names + all aliases as separate documents
// so single-word queries like "Citi" or "McKinsey" match correctly.
// ---------------------------------------------------------------------------

interface FuseDoc {
  id: string
  text: string
  canonicalName: string
  industry: string
}

let _fuse: Fuse<FuseDoc> | null = null

function getFuse(): Fuse<FuseDoc> {
  if (!_fuse) {
    const docs: FuseDoc[] = []

    for (const entry of CANONICAL_COMPANIES) {
      // Add the canonical name
      docs.push({
        id: entry.canonical,
        text: entry.canonical,
        canonicalName: entry.canonical,
        industry: entry.industry,
      })

      // Add each alias
      for (const alias of entry.aliases) {
        docs.push({
          id: `${entry.canonical}::${alias}`,
          text: alias,
          canonicalName: entry.canonical,
          industry: entry.industry,
        })
      }
    }

    _fuse = new Fuse(docs, {
      keys: ['text'],
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 3,
      shouldSort: true,
      distance: 100,
    })
  }

  return _fuse
}

// ---------------------------------------------------------------------------
// Normalisation helper — strip common suffixes / legal forms
// ---------------------------------------------------------------------------

const LEGAL_SUFFIX_RE =
  /(?:\s*[,.]?\s*(?:LLC|LLP|L\.L\.C\.|L\.L\.P\.|Inc|Inc\.|Corp|Corp\.|Corporation|Co|Co\.|Company|Ltd|Ltd\.|Limited|PLC|P\.L\.C\.|GmbH|AG|N\.A\.|NA|LP|L\.P\.))+\s*$/i

function stripLegalSuffix(raw: string): string {
  return raw.replace(LEGAL_SUFFIX_RE, '').trim()
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Normalize a raw company string to a canonical name + industry.
 *
 * Strategy:
 *  1. Clean & strip legal suffixes.
 *  2. Try exact match (case-insensitive) in alias map.
 *  3. Try fuzzy match via Fuse.js.
 *  4. If confidence > threshold, return canonical name + industry.
 *  5. Otherwise return the raw name with industry = "Other" and confidence = 0.
 */
const CONFIDENCE_THRESHOLD = 0.55

export function normalizeCompany(raw: string | null | undefined): NormalizationResult {
  if (!raw || !raw.trim()) {
    return { canonicalName: '', industry: 'Other', confidence: 0, matchedAlias: null }
  }

  const cleaned = raw.trim()
  const stripped = stripLegalSuffix(cleaned)
  const lower = stripped.toLowerCase()

  // --- Step 1: Check alias map (exact match) ---
  const aliasMap = buildAliasMap()
  const exact = aliasMap.get(lower)
  if (exact) {
    return {
      canonicalName: exact.canonicalName,
      industry: exact.industry,
      confidence: 1.0,
      matchedAlias: lower,
    }
  }

  // --- Step 1b: Try normalised variants ---
  const variants = [
    lower.replace(/\./g, '').trim(),
    lower.replace(/\./g, '').replace(/,/g, '').trim(),
    lower.replace(/&/g, 'and').replace(/\./g, '').replace(/,/g, '').trim(),
  ]

  for (const v of [...new Set(variants)]) {
    const match = aliasMap.get(v)
    if (match) {
      return {
        canonicalName: match.canonicalName,
        industry: match.industry,
        confidence: 1.0,
        matchedAlias: v,
      }
    }
  }

  // --- Step 2: Fuzzy match ---
  const fuse = getFuse()
  const results = fuse.search(stripped)

  if (results.length > 0) {
    const best = results[0]
    const score = best.score ?? 1.0
    const confidence = 1.0 - score

    if (confidence >= CONFIDENCE_THRESHOLD) {
      return {
        canonicalName: best.item.canonicalName,
        industry: best.item.industry,
        confidence: Math.round(confidence * 100) / 100,
        matchedAlias: best.item.text,
      }
    }
  }

  // --- No match ---
  return {
    canonicalName: cleaned,
    industry: 'Other',
    confidence: 0,
    matchedAlias: null,
  }
}
