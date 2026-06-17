-- Admin dashboard: reported content for moderation
CREATE TABLE IF NOT EXISTS reported_content (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'message',  -- 'message' | 'profile' | 'alumni'
  content_id  TEXT NOT NULL,                      -- ID of the reported item
  reason      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'flagged',     -- 'flagged' | 'dismissed' | 'removed'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id)
);

-- Admin dashboard: activity audit log
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,  -- 'signup' | 'login' | 'profile_update' | 'account_suspended' | 'account_verified'
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reported_content_status ON reported_content(status);
