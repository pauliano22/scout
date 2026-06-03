-- =====================================================================
-- Migration 025 — Phase 0 agent "action queue" foundation
-- =====================================================================
-- Three things:
--   1. Unify user_networks.status into ONE canonical vocabulary + CHECK.
--      Three vocabularies existed (TS type / mobile PATCH / mig-006 seed); the
--      live web UI already standardizes on the type vocabulary, so that is
--      canonical. All historical values are normalized into it. The mig-006
--      sync trigger already inserts 'interested' (canonical) — no trigger change.
--   2. Add user_networks.meeting_at (nullable) — gates timed PREP_MEETING and
--      is the hook Phase 3 reminders will use.
--   3. Create connection_action_state — per-(user, alumni, action_type)
--      dismiss/snooze overrides on the DERIVED action queue (we derive actions
--      live from state; this table only records the user's overrides). RLS by user.
--
-- Idempotent. Local/dev apply only for now — NOT run against production here.

-- ── 1. Unify status ─────────────────────────────────────────────────────────
ALTER TABLE public.user_networks ADD COLUMN IF NOT EXISTS status text; -- defensive; exists in prod

-- Normalize every historical value (TS type + old mobile/PATCH set + seeds).
UPDATE public.user_networks SET status = CASE
  WHEN status IN ('contacted', 'awaiting_reply')       THEN 'awaiting_reply'
  WHEN status IN ('replied', 'response_needed')        THEN 'response_needed'
  WHEN status IN ('meeting_set', 'meeting_scheduled')  THEN 'meeting_scheduled'
  WHEN status = 'met'                                  THEN 'met'
  WHEN status = 'not_interested'                       THEN 'not_interested'
  ELSE 'interested' -- null / '' / interested / active / saved / message_drafted / unknown
END;

ALTER TABLE public.user_networks ALTER COLUMN status SET DEFAULT 'interested';
ALTER TABLE public.user_networks DROP CONSTRAINT IF EXISTS user_networks_status_check;
ALTER TABLE public.user_networks ADD CONSTRAINT user_networks_status_check
  CHECK (status IN ('interested', 'awaiting_reply', 'response_needed', 'meeting_scheduled', 'met', 'not_interested'));

-- ── 2. meeting_at ───────────────────────────────────────────────────────────
ALTER TABLE public.user_networks ADD COLUMN IF NOT EXISTS meeting_at timestamptz;

-- ── 3. connection_action_state (dismiss / snooze overrides) ─────────────────
CREATE TABLE IF NOT EXISTS public.connection_action_state (
  id            uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  alumni_id     uuid REFERENCES public.alumni(id) ON DELETE CASCADE NOT NULL,
  -- the ActionType the override applies to (engine emits these 5 actionable types)
  action_type   text NOT NULL CHECK (action_type IN ('DRAFT_INTRO', 'SEND_FOLLOWUP', 'RESPOND', 'PREP_MEETING', 'SEND_THANKYOU')),
  state         text NOT NULL CHECK (state IN ('dismissed', 'snoozed')),
  snooze_until  timestamptz, -- required-by-convention when state = 'snoozed'
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, alumni_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_connection_action_state_user ON public.connection_action_state(user_id);

ALTER TABLE public.connection_action_state ENABLE ROW LEVEL SECURITY;

-- Policies (DROP first so the migration is re-runnable).
DROP POLICY IF EXISTS "own action state - select" ON public.connection_action_state;
DROP POLICY IF EXISTS "own action state - insert" ON public.connection_action_state;
DROP POLICY IF EXISTS "own action state - update" ON public.connection_action_state;
DROP POLICY IF EXISTS "own action state - delete" ON public.connection_action_state;

CREATE POLICY "own action state - select" ON public.connection_action_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own action state - insert" ON public.connection_action_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own action state - update" ON public.connection_action_state
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own action state - delete" ON public.connection_action_state
  FOR DELETE USING (auth.uid() = user_id);

-- Table-level grants. Supabase usually auto-grants new public tables to these
-- roles via default privileges, but make it explicit/reproducible. RLS still
-- restricts rows to the owning user; service_role bypasses RLS (override write).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_action_state TO authenticated;
GRANT ALL ON public.connection_action_state TO service_role;
