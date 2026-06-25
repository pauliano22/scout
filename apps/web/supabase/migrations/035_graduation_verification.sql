-- =====================================================================
-- Migration 035 — Graduation Year Verification Pipeline
-- =====================================================================
-- Tracks cross-referencing results between self-reported alumni
-- graduation_years and Cornell Athletics historical roster data.
--
-- A background cron job (api/cron/verify-graduation-years) populates
-- this table; admins review mismatches in the admin UI.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.graduation_verification (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alumni_id     UUID NOT NULL REFERENCES public.alumni(id) ON DELETE CASCADE,
  reported_year INTEGER NOT NULL,
  roster_year   INTEGER,            -- null when no roster match found
  match_status  TEXT NOT NULL CHECK (match_status IN ('verified', 'mismatch', 'unverified', 'pending')),
  reviewed      BOOLEAN NOT NULL DEFAULT false,
  flagged_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the cron job: find alumni not yet verified
CREATE INDEX IF NOT EXISTS idx_grad_verification_alumni
  ON public.graduation_verification (alumni_id);

-- Index for the admin UI: list flagged mismatches ordered by recency
CREATE INDEX IF NOT EXISTS idx_grad_verification_flagged
  ON public.graduation_verification (flagged_at DESC NULLS LAST)
  WHERE match_status = 'mismatch' AND reviewed = false;

-- Unique constraint: one verification row per alumni
CREATE UNIQUE INDEX IF NOT EXISTS idx_grad_verification_unique_alumni
  ON public.graduation_verification (alumni_id);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.update_grad_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grad_verification_updated_at ON public.graduation_verification;
CREATE TRIGGER trg_grad_verification_updated_at
  BEFORE UPDATE ON public.graduation_verification
  FOR EACH ROW EXECUTE FUNCTION public.update_grad_verification_updated_at();

-- Row-level security: admins only
ALTER TABLE public.graduation_verification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read graduation_verification"
  ON public.graduation_verification
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can insert graduation_verification"
  ON public.graduation_verification
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update graduation_verification"
  ON public.graduation_verification
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');
