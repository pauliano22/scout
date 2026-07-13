-- RLS hardening for audit tables that predate the security pipeline.
--
-- password_reset_audit_log (migration 042) stores emails + IPs and had no
-- RLS, so the anon/authenticated PostgREST roles could read it. All
-- legitimate access goes through the service role (forgot-password /
-- reset-password route handlers), which bypasses RLS — lock the table down
-- with explicit service-role-only policies (matching migration 044's style).
--
-- activity_log (migration 030) likewise had no RLS. Admin reads and cron
-- reads use the service role; the only session-authenticated write is
-- POST /api/activity/log, which inserts the caller's own row — keep an
-- authenticated INSERT policy scoped to auth.uid() and nothing else.

-- ── password_reset_audit_log: service-role only ─────────────────────────

ALTER TABLE public.password_reset_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only — select password reset audit"
  ON public.password_reset_audit_log FOR SELECT
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only — insert password reset audit"
  ON public.password_reset_audit_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ── activity_log: users may insert their own rows; reads are service-role ──

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own activity"
  ON public.activity_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role only — select activity"
  ON public.activity_log FOR SELECT
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only — insert activity"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
