-- Migration 027: Add unique constraint on alumni.linkedin_url
--
-- This adds a partial unique index on the linkedin_url column of the alumni table.
-- The index only applies to non-null, non-empty values, allowing NULL entries
-- while ensuring no two alumni share the same non-blank URL.

CREATE UNIQUE INDEX IF NOT EXISTS alumni_linkedin_url_unique_idx
  ON public.alumni (linkedin_url)
  WHERE linkedin_url IS NOT NULL AND linkedin_url != '';
