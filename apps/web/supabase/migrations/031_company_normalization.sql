-- ============================================================
-- Migration 031: Company Name Normalization Pipeline
-- ============================================================
-- Creates an industry_category enum, a company_aliases lookup
-- table, and adds an industry column to the alumni table.
-- ============================================================

-- 1. Industry category enum
DO $$ BEGIN
  CREATE TYPE industry_category AS ENUM (
    'Finance',
    'Consulting',
    'Technology',
    'Law',
    'Medicine',
    'Sports',
    'Education',
    'Media',
    'Real Estate',
    'Non-Profit',
    'Government',
    'Other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Company aliases lookup table
CREATE TABLE IF NOT EXISTS company_aliases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name  TEXT NOT NULL,
  alias           TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ensure no duplicate aliases
  CONSTRAINT uq_company_alias UNIQUE (alias)
);

-- Index for fast alias lookup
CREATE INDEX IF NOT EXISTS idx_company_aliases_alias ON company_aliases (alias);

-- 3. Add industry column to profiles table (uses TEXT so existing code doesn't break)
--    The enum is available for reference; the column stores the category string.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS canonical_company TEXT,
  ADD COLUMN IF NOT EXISTS industry_category industry_category;

-- 4. Add industry column to alumni table (same pattern)
ALTER TABLE alumni
  ADD COLUMN IF NOT EXISTS canonical_company TEXT,
  ADD COLUMN IF NOT EXISTS industry_category industry_category;

-- 5. Add the same columns to opportunities (which also has a company field)
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS canonical_company TEXT,
  ADD COLUMN IF NOT EXISTS industry_category industry_category;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_industry_category    ON profiles (industry_category);
CREATE INDEX IF NOT EXISTS idx_alumni_industry_category      ON alumni (industry_category);
CREATE INDEX IF NOT EXISTS idx_profiles_canonical_company    ON profiles (canonical_company);
CREATE INDEX IF NOT EXISTS idx_alumni_canonical_company      ON alumni (canonical_company);
CREATE INDEX IF NOT EXISTS idx_opportunities_industry_category ON opportunities (industry_category);
