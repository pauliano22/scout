-- Composite index for server-side alumni search/filter/pagination
-- Covers common query patterns: is_public + industry/sport filters + graduation_year sort
CREATE INDEX IF NOT EXISTS idx_alumni_public_filters
  ON alumni(is_public, industry, sport, graduation_year DESC);
