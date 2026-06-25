-- IDEA 31: Signup Funnel Analytics & Abandoned Registration Recovery
-- Tracks each step of the signup funnel and flags abandoned registrations.

CREATE TABLE IF NOT EXISTS public.signup_events (
  id         uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id text NOT NULL,
  step       text NOT NULL CHECK (step IN ('landing', 'form', 'submit', 'verify', 'complete')),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.abandoned_registrations (
  id               uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email            text NOT NULL,
  session_id       text NOT NULL,
  last_step        text NOT NULL,
  recovery_sent_at timestamptz,
  recovered        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_events_session ON public.signup_events (session_id);
CREATE INDEX IF NOT EXISTS idx_signup_events_step ON public.signup_events (step);
CREATE INDEX IF NOT EXISTS idx_abandoned_reg_sent ON public.abandoned_registrations (recovery_sent_at) WHERE recovery_sent_at IS NULL;

ALTER TABLE public.signup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abandoned_registrations ENABLE ROW LEVEL SECURITY;

-- Users can read their own signup events (for funnel status queries).
CREATE POLICY "Users can read own signup events"
  ON public.signup_events FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert and read everything.
CREATE POLICY "Service role full access signup_events"
  ON public.signup_events
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Service role full access to abandoned_registrations (reads for cron, inserts for tracking).
CREATE POLICY "Service role full access abandoned_registrations"
  ON public.abandoned_registrations
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
