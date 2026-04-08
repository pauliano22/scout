/**
 * Detects known placeholder/generic avatar URLs.
 *
 * Strategy: deterministic URL-pattern matching only — no image loading, no ML.
 * Returns true if the URL is likely a generic silhouette that should be hidden
 * in favour of an initials avatar.
 *
 * Covered cases:
 *  - Filenames/paths containing "default", "placeholder", "silhouette", etc.
 *  - LinkedIn ghost/default avatar CDN paths
 *  - Gravatar "mystery man" and other generic fallback types
 *  - ui-avatars.com letter generators (we generate our own initials, so skip)
 *  - Apollo / enrichment provider known placeholder patterns
 *
 * NOT covered (acceptable limitation):
 *  - A valid LinkedIn CDN URL that happens to show a grey silhouette.
 *    These are indistinguishable by URL alone; the onError handler in
 *    Avatar.tsx catches any that 404 or return a broken image.
 */

const PLACEHOLDER_PATH_PATTERNS: RegExp[] = [
  /default[-_]?avatar/i,
  /avatar[-_]?default/i,
  /no[-_]?photo/i,
  /no[-_]?image/i,
  /nophoto/i,
  /placeholder/i,
  /silhouette/i,
  /ghost[-_]?(avatar|person|user)?/i,
  /blank[-_]?(avatar|profile)/i,
  /generic[-_]?(avatar|profile)/i,
  /anonymous/i,
  /unknown[-_]?(person|user|avatar)/i,
  // LinkedIn's ghost profile photo segment
  /\/ghost\//i,
  // Common CDN pattern for auto-generated / default profile images
  /profile[-_]?default/i,
  /default[-_]?profile/i,
  // Apollo.io and similar enrichment providers serving generic silhouettes
  /\/default\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i,
  // Gravatar generic fallbacks (mm = mystery man, mp = mystery person)
  /gravatar\.com\/avatar\/.*[?&]d=(mm|mp|identicon|wavatar|retro|robohash|blank)/i,
  // ui-avatars.com — we generate better initials ourselves
  /ui-avatars\.com/i,
]

export function isLikelyPlaceholderAvatar(url: string | null | undefined): boolean {
  if (!url || url.trim() === '') return true
  return PLACEHOLDER_PATH_PATTERNS.some(pattern => pattern.test(url))
}
