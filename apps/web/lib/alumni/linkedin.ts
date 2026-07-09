import type { SupabaseClient } from '@supabase/supabase-js'

// Shared LinkedIn-URL helpers for the import route and the claim flow's
// auto-fill. We "scrape" from our own enriched directory: rows keyed by
// linkedin_url (unique, mig 027) already carry work_history / education.

/** Extract the /in/<slug> from any linkedin URL variant, lowercased. */
export function linkedinSlug(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.toLowerCase().match(/linkedin\.com\/in\/([\w\-%.]+)/)
  return m ? m[1].replace(/\/+$/, '') : null
}

export interface LinkedInDirectoryRow {
  id: string
  linkedin_url: string | null
  company: string | null
  role: string | null
  location: string | null
  work_history: unknown
  education: unknown
  claimed_by_user_id: string | null
}

/**
 * Directory rows whose linkedin_url matches the slug exactly. The ilike is a
 * prefix net (john-smith also catches john-smith-2), so callers get only
 * exact-slug rows back. Pass a service client: the caller's own scraped row
 * may predate their claim and RLS would hide it; enforce ownership after.
 */
export async function findAlumniByLinkedInSlug(
  db: SupabaseClient,
  slug: string,
): Promise<LinkedInDirectoryRow[]> {
  const { data } = await db
    .from('alumni')
    .select('id, linkedin_url, company, role, location, work_history, education, claimed_by_user_id')
    .ilike('linkedin_url', `%linkedin.com/in/${slug}%`)
    .limit(5)
  return ((data ?? []) as LinkedInDirectoryRow[]).filter(
    (r) => linkedinSlug(r.linkedin_url) === slug,
  )
}
