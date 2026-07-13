-- Migration 066: data-rights tooling (DPA §8).
--
-- 1. Email-ownership verification for alumni removal requests (closes the
--    hardening TODO from migration 053): requests that include an email now
--    get a confirmation link; the hide happens on confirm, so the public
--    /remove endpoint can no longer be used to hide arbitrary people whose
--    email you know. Token pattern mirrors password_reset_tokens.
--
-- 2. alumni_suppression — a do-not-reimport list. When an admin hard-deletes
--    an alumni row from /admin/removals, the person's email and/or LinkedIn
--    URL land here so future imports (scripts/supabase_import.py), opt-in
--    submissions (/api/alumni/submit) and the enrichment cron skip them.
--    Otherwise the next scrape would silently resurrect a deleted person.

BEGIN;

-- ── Removal request verification columns ────────────────────────────────

ALTER TABLE public.alumni_removal_requests
  ADD COLUMN IF NOT EXISTS verify_token            text,
  ADD COLUMN IF NOT EXISTS verify_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified                boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at             timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_removal_requests_verify_token
  ON public.alumni_removal_requests(verify_token) WHERE verify_token IS NOT NULL;

-- ── Suppression list ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alumni_suppression (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             text,
  linkedin_url      text,
  full_name         text,
  reason            text,
  source_request_id uuid REFERENCES public.alumni_removal_requests(id) ON DELETE SET NULL,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR linkedin_url IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alumni_suppression_email
  ON public.alumni_suppression (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_alumni_suppression_linkedin
  ON public.alumni_suppression (lower(linkedin_url)) WHERE linkedin_url IS NOT NULL;

-- RLS: admin-only, mirrors alumni_removal_requests (migration 053). All app
-- writes go through the service role.
ALTER TABLE public.alumni_suppression ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage alumni suppression" ON public.alumni_suppression;
CREATE POLICY "Admins can manage alumni suppression"
  ON public.alumni_suppression
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.account_role = 'admin'::public.user_role)
    )
  );

COMMIT;
