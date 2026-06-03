-- Checkpoint A verification — run on a LOCAL/DEV database after applying
-- migration 025 (NOT production). No DB tooling exists in the build env, so
-- this could not be executed here; it's a ready-to-run runbook.
--
-- The dismiss/snooze *behavior* (override removes / hides an action) is also
-- verified as pure logic in evals/agent/nextBestAction.eval.ts (applyOverrides
-- fixtures), which runs without a DB. This file covers the parts that need a
-- real Postgres: the CHECK constraints and RLS.

-- ── 1. status was unified + CHECK enforces canonical set ────────────────────
-- Expect: only the 6 canonical values present, zero legacy values.
SELECT status, count(*) FROM public.user_networks GROUP BY status ORDER BY 2 DESC;
--   PASS: every row in {interested,awaiting_reply,response_needed,meeting_scheduled,met,not_interested}

-- Expect: this INSERT is REJECTED by user_networks_status_check.
-- INSERT INTO public.user_networks (user_id, alumni_id, status)
--   VALUES ('<uuid>', '<uuid>', 'meeting_set');   -- legacy value → should ERROR

-- ── 2. meeting_at exists + nullable ─────────────────────────────────────────
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'user_networks' AND column_name = 'meeting_at';
--   PASS: one row, timestamptz, is_nullable = YES

-- ── 3. connection_action_state: CHECK constraints ──────────────────────────
-- Expect REJECTED (bad action_type):
-- INSERT INTO public.connection_action_state (user_id, alumni_id, action_type, state)
--   VALUES ('<uuid>','<uuid>','NONSENSE','dismissed');   -- → ERROR
-- Expect REJECTED (bad state):
-- INSERT INTO public.connection_action_state (user_id, alumni_id, action_type, state)
--   VALUES ('<uuid>','<uuid>','DRAFT_INTRO','frozen');    -- → ERROR

-- ── 4. RLS blocks cross-user reads (needs two real auth users) ──────────────
-- As user A (set request.jwt.claim.sub = A), insert one row. Then as user B,
-- SELECT * FROM connection_action_state → must return 0 rows of A's.
-- In the Supabase SQL editor, simulate with:
--   SET request.jwt.claims = '{"sub":"<USER_A_UUID>"}';
--   INSERT INTO public.connection_action_state (user_id, alumni_id, action_type, state)
--     VALUES ('<USER_A_UUID>', '<alumni_uuid>', 'DRAFT_INTRO', 'dismissed');
--   SET request.jwt.claims = '{"sub":"<USER_B_UUID>"}';
--   SELECT count(*) FROM public.connection_action_state;   -- PASS: 0
--   SET request.jwt.claims = '{"sub":"<USER_A_UUID>"}';
--   SELECT count(*) FROM public.connection_action_state;   -- PASS: 1
