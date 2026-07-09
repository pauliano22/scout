-- Migration 058: record what a connection actually led to.
--
-- replied_at (054) captures the first success signal; this captures the one an
-- Athletic Director actually cares about — did the meeting turn into anything?
-- Adds user_networks.outcome, logged by the student from the Network board
-- after a row reaches 'met'. NULL = no outcome logged (yet).
--
-- 'helpful_convo' is deliberate: most meetings end there, and counting it keeps
-- the referral/interview/offer numbers honest instead of inflated by silence.

BEGIN;

ALTER TABLE public.user_networks
  ADD COLUMN IF NOT EXISTS outcome text
  CHECK (outcome IN ('helpful_convo', 'referral', 'interview', 'offer')),
  ADD COLUMN IF NOT EXISTS outcome_at timestamptz;

COMMENT ON COLUMN public.user_networks.outcome IS
  'What the connection led to, logged by the student after status = met: '
  'helpful_convo, referral, interview, or offer. NULL = nothing logged yet. '
  'Powers the outcome metrics on the AD report.';

CREATE INDEX IF NOT EXISTS idx_user_networks_outcome
  ON public.user_networks(outcome) WHERE outcome IS NOT NULL;

COMMIT;
