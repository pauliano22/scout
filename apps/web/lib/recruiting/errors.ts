// The CRM ships before its migration is applied: reads degrade to a
// read-only overlay (crmReady=false), writes return an actionable 409.

interface DbErrorLike {
  code?: string
  message?: string
}

/** Postgres undefined_table (42P01) or PostgREST schema-cache miss (PGRST205). */
export function isMissingTableError(error: DbErrorLike | null): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /relation .* does not exist|schema cache/i.test(error.message ?? '')
}

export const MIGRATION_HINT =
  'CRM tables not found — apply supabase/migrations/070_recruiting_crm.sql to enable writes.'
