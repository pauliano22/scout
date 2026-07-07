-- Migration 053: alumni self-serve removal / opt-out.
--
-- WHY: the alumni directory is built by scraping public sources + LinkedIn. People
-- who never signed up currently have NO way to remove or hide their record — a
-- legal (right-to-deletion), PR, and Cornell-partnership liability (audit risk #1).
-- This adds a request log so anyone can ask to be removed; the public endpoint
-- (POST /api/alumni/remove-request) records the request and, on a confident match,
-- immediately hides the row (is_public = false) — erring toward privacy. Hiding is
-- reversible by an admin if a request is abusive.
--
-- Numbered 053 to sit after the RLS/signup migration 052 (independent branch); the
-- two don't depend on each other.
--
-- NOTE (hardening follow-up, not in this migration): confirm ownership via an
-- email link before hiding, and add a captcha to the public endpoint.

BEGIN;

CREATE TABLE IF NOT EXISTS public.alumni_removal_requests (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  alumni_id         uuid REFERENCES public.alumni(id) ON DELETE SET NULL,
  submitted_name    text NOT NULL,
  submitted_email   text,
  submitted_linkedin text,
  reason            text,
  requester_ip      text,
  matched           boolean NOT NULL DEFAULT false,  -- did we find + hide a row?
  status            text NOT NULL DEFAULT 'pending'  -- 'pending' | 'actioned' | 'rejected'
                     CHECK (status IN ('pending', 'actioned', 'rejected')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  actioned_at       timestamptz,
  actioned_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_removal_requests_status
  ON public.alumni_removal_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_removal_requests_alumni
  ON public.alumni_removal_requests(alumni_id) WHERE alumni_id IS NOT NULL;

-- RLS: no public/authenticated access. The public endpoint writes via the service
-- role (bypasses RLS); only admins can read/manage requests. Mirrors migration 032.
ALTER TABLE public.alumni_removal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage removal requests" ON public.alumni_removal_requests;
CREATE POLICY "Admins can manage removal requests"
  ON public.alumni_removal_requests
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
