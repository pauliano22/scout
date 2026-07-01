-- IDEA 41: Alumni Census Gap Analysis
-- Creates a table for storing quarterly census reports by sport and graduation year

CREATE TABLE IF NOT EXISTS public.census_reports (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  sport           text NOT NULL,
  graduation_year int NOT NULL,
  total_rostered  int NOT NULL DEFAULT 0,
  total_registered int NOT NULL DEFAULT 0,
  coverage_pct    numeric(5,2) NOT NULL DEFAULT 0,
  gap_category    text NOT NULL CHECK (gap_category IN ('critical', 'growing', 'healthy')),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_census_sport_year 
  ON public.census_reports (sport, graduation_year);
CREATE INDEX IF NOT EXISTS idx_census_generated 
  ON public.census_reports (generated_at DESC);

ALTER TABLE public.census_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read census reports"
  ON public.census_reports FOR SELECT
  USING (auth.role() = 'authenticated');
