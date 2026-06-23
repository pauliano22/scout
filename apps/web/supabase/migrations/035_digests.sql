-- Migration 035: Weekly Re-Engagement Digest
-- Tracks which digest emails have been sent to which users
-- to avoid duplicates and support analytics.

CREATE TABLE IF NOT EXISTS public.sent_digests (
  id         BIGSERIAL    PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  digest_type TEXT        NOT NULL DEFAULT 'weekly_reengagement',
  -- Metadata (nullable, for debugging / analytics)
  subject    TEXT,
  error      TEXT
);

-- Index for checking last-digest-per-user efficiently
CREATE INDEX IF NOT EXISTS idx_sent_digests_user_sent_at
  ON public.sent_digests(user_id, sent_at DESC);

-- Index for cron queries (users who haven't received one recently)
CREATE INDEX IF NOT EXISTS idx_sent_digests_type_sent_at
  ON public.sent_digests(digest_type, sent_at DESC);

-- Row-level security: service role only (no public access)
ALTER TABLE public.sent_digests ENABLE ROW LEVEL SECURITY;

-- Only the service role (used by cron endpoint) can read/write
CREATE POLICY "sent_digests_service_only"
  ON public.sent_digests
  FOR ALL
  USING (false)
  WITH CHECK (false);
