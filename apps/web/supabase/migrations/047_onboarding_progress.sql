-- Migration 035: Onboarding Progress Bar with Milestone Celebrations
--
-- Tracks which onboarding milestones a user has completed.
-- Written to by the GET /api/onboarding/progress route on each read,
-- so it always reflects the current state of the user's profile, network, and messages.

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  has_photo          BOOLEAN NOT NULL DEFAULT FALSE,
  has_bio            BOOLEAN NOT NULL DEFAULT FALSE,
  has_first_connection BOOLEAN NOT NULL DEFAULT FALSE,
  has_first_message  BOOLEAN NOT NULL DEFAULT FALSE,
  completed_steps    TEXT[] NOT NULL DEFAULT '{}',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient querying of incomplete users
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_incomplete
  ON public.onboarding_progress (user_id)
  WHERE NOT (has_photo AND has_bio AND has_first_connection AND has_first_message);

-- Auto-update updated_at on write
CREATE OR REPLACE FUNCTION public.update_onboarding_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_onboarding_progress_updated_at ON public.onboarding_progress;
CREATE TRIGGER trg_onboarding_progress_updated_at
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_onboarding_progress_timestamp();

-- RLS: users can only see/update their own row
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own onboarding progress"
  ON public.onboarding_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own onboarding progress"
  ON public.onboarding_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding progress"
  ON public.onboarding_progress
  FOR UPDATE
  USING (auth.uid() = user_id);
