// Text a scraper captured off a captcha / login / security-check wall instead of
// the real profile field — never a legitimate role, company, or headline.
const SCRAPE_ARTIFACT = /^(re)?captcha$|^security verification$|^sign in$|^join linkedin$/i

/**
 * Normalizes an alumni field value scraped from LinkedIn/public records.
 * Returns null for placeholder values so UI can safely fall back.
 */
export function cleanField(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = value
    .replace(/-\s*LinkedIn$/i, '')  // remove trailing " - LinkedIn" suffix
    .trim()
  // Treat placeholder/empty scraper artifacts as null
  if (!cleaned || cleaned === '...' || cleaned === '-' || cleaned === 'N/A') return null
  if (SCRAPE_ARTIFACT.test(cleaned)) return null
  return cleaned
}
