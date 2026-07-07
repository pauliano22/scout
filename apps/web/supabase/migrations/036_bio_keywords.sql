-- IDEA 62: Profile Bio Keyword Extraction for Searchable Tags
-- Creates a table for extracted keywords from alumni bios and
-- adds a tracking column on the alumni table.

-- Table: profile_keywords — stores individual keywords extracted from alumni bios
CREATE TABLE IF NOT EXISTS public.profile_keywords (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  alumni_id   uuid NOT NULL REFERENCES public.alumni(id) ON DELETE CASCADE,
  keyword     text NOT NULL,
  category    text NOT NULL CHECK (category IN ('skill', 'industry', 'certification', 'milestone')),
  source      text NOT NULL DEFAULT 'extraction',
  created_at  timestamptz DEFAULT now()
);

-- Index on keyword for search
CREATE INDEX IF NOT EXISTS idx_profile_keywords_keyword
  ON public.profile_keywords (keyword);

-- Index on alumni_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_profile_keywords_alumni_id
  ON public.profile_keywords (alumni_id);

-- Composite index for category-filtered searches
CREATE INDEX IF NOT EXISTS idx_profile_keywords_category_keyword
  ON public.profile_keywords (category, keyword);

-- Add tracking column to alumni table for processed bio extraction
ALTER TABLE public.alumni
  ADD COLUMN IF NOT EXISTS keywords_extracted boolean NOT NULL DEFAULT false;

-- RLS: service-role only (cron job runs with service role)
ALTER TABLE public.profile_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only — select profile_keywords"
  ON public.profile_keywords FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role only — insert profile_keywords"
  ON public.profile_keywords FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role only — update profile_keywords"
  ON public.profile_keywords FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role only — delete profile_keywords"
  ON public.profile_keywords FOR DELETE
  USING (auth.role() = 'service_role');
