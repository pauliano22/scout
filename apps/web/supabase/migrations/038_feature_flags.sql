-- Lightweight Feature Flag System
-- Enables toggling incomplete features, gradual rollouts, and kill-switches.

CREATE TABLE IF NOT EXISTS public.feature_flags (
  flag_name         TEXT PRIMARY KEY,
  enabled           BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INT NOT NULL DEFAULT 100,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial flags
INSERT INTO public.feature_flags (flag_name, enabled, rollout_percentage) VALUES
  ('new_jobs_board', false, 100),
  ('onboarding_progress_bar', false, 100),
  ('mentorship_matching', false, 100)
ON CONFLICT (flag_name) DO NOTHING;

-- RLS: only admins can mutate; everyone can read
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature_flags"
  ON public.feature_flags
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert feature_flags"
  ON public.feature_flags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update feature_flags"
  ON public.feature_flags
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can delete feature_flags"
  ON public.feature_flags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
