import type { SupabaseClient } from '@supabase/supabase-js'
import { linkedinSlug } from './linkedin'

// alumni_suppression (migration 066) is the do-not-reimport list written when
// an admin hard-deletes a directory row. Import/enrichment entry points load
// the sets once per run and skip anything that matches, so a deleted person
// isn't silently resurrected by the next scrape or opt-in submission.

export interface SuppressionSets {
  emails: Set<string>
  linkedinSlugs: Set<string>
}

/** Pass a service client — the table is admin-only under RLS. */
export async function getSuppressionSets(db: SupabaseClient): Promise<SuppressionSets> {
  const emails = new Set<string>()
  const linkedinSlugs = new Set<string>()
  try {
    const { data } = await db.from('alumni_suppression').select('email, linkedin_url')
    for (const row of data ?? []) {
      const email = (row.email as string | null)?.trim().toLowerCase()
      if (email) emails.add(email)
      const slug = linkedinSlug(row.linkedin_url as string | null)
      if (slug) linkedinSlugs.add(slug)
    }
  } catch (e) {
    // Fail open on read errors — suppression is belt-and-braces on top of the
    // hard delete itself, and an import must not crash because of it.
    console.error('[suppression] load failed:', e instanceof Error ? e.message : e)
  }
  return { emails, linkedinSlugs }
}

export function isSuppressed(
  sets: SuppressionSets,
  record: { email?: string | null; linkedin_url?: string | null },
): boolean {
  const email = record.email?.trim().toLowerCase()
  if (email && sets.emails.has(email)) return true
  const slug = linkedinSlug(record.linkedin_url ?? null)
  if (slug && sets.linkedinSlugs.has(slug)) return true
  return false
}
