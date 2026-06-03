-- =====================================================================
-- Migration 026 — Agent campaign spine (Phase 1)
-- =====================================================================
-- Turns the reactive Today engine into a goal-holding CAMPAIGN agent. Adds:
--   1. Campaign columns on networking_plans (the campaign container).
--   2. A 'proposed' status on user_networks — the GATE: cron-sourced alumni
--      land here and are NEVER live outreach until the student approves
--      (proposed -> interested). The engine treats 'proposed' as non-actionable.
--   3. alumni_outreach_ledger — a CROSS-USER record so one alum can't be
--      over-fished by many students' campaigns. Enforced service-role in the
--      sourcing gate (a cross-user invariant RLS can't express).
--   4. outreach_queue — persisted drafts the cron prepares BEFORE login,
--      'queued_for_approval' until the student approves+sends (human-in-loop).
--
-- SEQUENCING (lesson from mig 025): deploy the tolerant code that reads these
-- objects BEFORE applying this migration to any environment with real users.
-- Apply on DEV first. Idempotent.

-- ── 1. Campaign columns on networking_plans ────────────────────────────────
-- target_count reuses the existing goal_count column.
ALTER TABLE public.networking_plans
  ADD COLUMN IF NOT EXISTS goal_metric    text,
  ADD COLUMN IF NOT EXISTS deadline       date,
  ADD COLUMN IF NOT EXISTS campaign_status text,
  ADD COLUMN IF NOT EXISTS current_count  int  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_tick_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_sourced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sourcing_enabled boolean DEFAULT true;

ALTER TABLE public.networking_plans ALTER COLUMN goal_metric SET DEFAULT 'informational_interview';
UPDATE public.networking_plans SET goal_metric = 'informational_interview' WHERE goal_metric IS NULL;
ALTER TABLE public.networking_plans DROP CONSTRAINT IF EXISTS networking_plans_goal_metric_check;
ALTER TABLE public.networking_plans ADD CONSTRAINT networking_plans_goal_metric_check
  CHECK (goal_metric IN ('informational_interview', 'referral', 'mentor_relationship'));

ALTER TABLE public.networking_plans ALTER COLUMN campaign_status SET DEFAULT 'active';
UPDATE public.networking_plans SET campaign_status = 'active' WHERE campaign_status IS NULL;
ALTER TABLE public.networking_plans DROP CONSTRAINT IF EXISTS networking_plans_campaign_status_check;
ALTER TABLE public.networking_plans ADD CONSTRAINT networking_plans_campaign_status_check
  CHECK (campaign_status IN ('active', 'completed', 'paused'));

-- ── 2. 'proposed' gate state on user_networks ──────────────────────────────
-- Extends the mig-025 canonical vocabulary with 'proposed'. Cron writes
-- user_networks DIRECTLY as 'proposed' (it does NOT go through the mig-006
-- plan_alumni trigger, which inserts 'interested' = live). Only student
-- approval flips proposed -> interested. The engine ignores 'proposed'.
ALTER TABLE public.user_networks DROP CONSTRAINT IF EXISTS user_networks_status_check;
ALTER TABLE public.user_networks ADD CONSTRAINT user_networks_status_check
  CHECK (status IN ('proposed', 'interested', 'awaiting_reply', 'response_needed', 'meeting_scheduled', 'met', 'not_interested'));

-- ── 3. alumni_outreach_ledger (cross-user over-fishing guard) ──────────────
-- One row per (student first-contacts alum). The sourcing gate counts DISTINCT
-- user_id per alumni in a trailing window and excludes capped alumni from
-- EVERY student's candidate set. No per-user RLS (cross-user invariant);
-- service_role only.
CREATE TABLE IF NOT EXISTS public.alumni_outreach_ledger (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  alumni_id   uuid REFERENCES public.alumni(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (alumni_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_alumni_outreach_ledger_alum_time
  ON public.alumni_outreach_ledger(alumni_id, created_at);

ALTER TABLE public.alumni_outreach_ledger ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT policies for authenticated → RLS denies all by default;
-- only the service-role cron reads/writes this cross-user table.
GRANT ALL ON public.alumni_outreach_ledger TO service_role;

-- ── 4. outreach_queue (drafts prepared before login) ───────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_queue (
  id            uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  alumni_id     uuid REFERENCES public.alumni(id) ON DELETE CASCADE NOT NULL,
  plan_id       uuid REFERENCES public.networking_plans(id) ON DELETE SET NULL,
  message_type  text NOT NULL CHECK (message_type IN ('introduction', 'follow_up', 'thank_you')),
  channel       text NOT NULL CHECK (channel IN ('email', 'linkedin')),
  draft_body    text NOT NULL,
  why           text,
  status        text NOT NULL DEFAULT 'queued_for_approval'
                  CHECK (status IN ('queued_for_approval', 'approved_sent', 'dismissed')),
  created_at    timestamptz DEFAULT now(),
  sent_at       timestamptz,
  UNIQUE (user_id, alumni_id, message_type)
);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_user_status ON public.outreach_queue(user_id, status);

ALTER TABLE public.outreach_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own outreach_queue - select" ON public.outreach_queue;
DROP POLICY IF EXISTS "own outreach_queue - update" ON public.outreach_queue;
CREATE POLICY "own outreach_queue - select" ON public.outreach_queue
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own outreach_queue - update" ON public.outreach_queue
  FOR UPDATE USING (auth.uid() = user_id);
-- INSERT is service-role only (the cron prepares drafts); students never insert.
GRANT SELECT, UPDATE ON public.outreach_queue TO authenticated;
GRANT ALL ON public.outreach_queue TO service_role;
