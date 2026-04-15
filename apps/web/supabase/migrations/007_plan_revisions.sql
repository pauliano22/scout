-- 007_plan_revisions.sql
-- Plan feedback revisions: company bio, remove auto-sync trigger, usage tracking

-- 1. Add ai_company_bio to plan_alumni
ALTER TABLE plan_alumni ADD COLUMN IF NOT EXISTS ai_company_bio TEXT;

-- 2. Drop the auto-sync trigger (alumni should NOT be auto-added to network)
DROP TRIGGER IF EXISTS trigger_sync_plan_alumni ON plan_alumni;
DROP FUNCTION IF EXISTS sync_plan_alumni_to_network();

-- 3. Create user_events table for usage tracking
CREATE TABLE IF NOT EXISTS user_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_created ON user_events(created_at);

-- RLS for user_events
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own events"
  ON user_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own events"
  ON user_events FOR SELECT
  USING (auth.uid() = user_id);
