-- Track which security_alerts have been announced to the admin Telegram
-- channel, so the hourly check-security-alerts cron doesn't re-notify the
-- same alert every run. NULL = not yet notified (the cron picks these up).

ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_security_alerts_unnotified
  ON public.security_alerts (created_at)
  WHERE notified_at IS NULL;
