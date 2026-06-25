-- IDEA 58: Security Incident Logging and Alerting Pipeline
-- Creates tables for structured security event logging and threshold-based alerting.

CREATE TABLE IF NOT EXISTS public.security_events (
  id             uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type     text NOT NULL,
  severity       text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  source_ip      text,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details        jsonb NOT NULL DEFAULT '{}',
  acknowledged   boolean NOT NULL DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_alerts (
  id               uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  rule_name        text NOT NULL,
  threshold        int NOT NULL,
  actual_count     int NOT NULL,
  events           jsonb NOT NULL DEFAULT '[]',
  acknowledged     boolean NOT NULL DEFAULT false,
  acknowledged_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_security_events_event_type
  ON public.security_events (event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity
  ON public.security_events (severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at
  ON public.security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_unacknowledged
  ON public.security_events (acknowledged, created_at DESC)
  WHERE acknowledged = false;
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at
  ON public.security_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_acknowledged
  ON public.security_alerts (acknowledged, created_at DESC)
  WHERE acknowledged = false;

-- RLS: service-role only — no direct user access
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Only service-role (or superadmin) should touch these tables
CREATE POLICY "Service role only — select"
  ON public.security_events FOR SELECT
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only — insert"
  ON public.security_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role only — update"
  ON public.security_events FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role only — select"
  ON public.security_alerts FOR SELECT
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only — insert"
  ON public.security_alerts FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role only — update"
  ON public.security_alerts FOR UPDATE
  USING (auth.role() = 'service_role');
