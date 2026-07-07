-- Migration 054: record when an alum replied.
--
-- Adds user_networks.replied_at, set when the student logs that the alum wrote
-- back (status → response_needed). Today that transition has no low-friction UI
-- and the outcome is never captured — yet "who replied, and how fast" is the
-- single success metric Scout can measure (sends happen off-platform) and the
-- proof asset for an employer / Cornell pitch. Powers reply-rate and
-- time-to-reply (replied_at − contacted_at).
--
-- Numbered 054 to sit after 052 (RLS) and 053 (opt-out) on their own branches;
-- none depend on each other.

BEGIN;

ALTER TABLE public.user_networks
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;

COMMENT ON COLUMN public.user_networks.replied_at IS
  'When the student logged that the alum replied (status → response_needed). '
  'Powers reply-rate and time-to-reply outcome metrics.';

CREATE INDEX IF NOT EXISTS idx_user_networks_replied_at
  ON public.user_networks(replied_at) WHERE replied_at IS NOT NULL;

COMMIT;
