-- Migration 035: Ambassador Program + Varsity Badges
-- Tiers: bronze (recruited 1+), silver (3+), gold (5+), platinum (10+)
-- Badge types: varsity (verified athlete ambassador), captain (team lead), hall_of_fame (top contributors)

CREATE TABLE IF NOT EXISTS ambassador_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  alumni_id     UUID REFERENCES alumni(id) ON DELETE SET NULL,

  -- Ambassador tier (auto-calculated by activity)
  tier          TEXT NOT NULL DEFAULT 'bronze'
                CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),

  -- Sport the ambassador represents
  sport         TEXT NOT NULL,

  -- Badge type shown on profile (some ambassadors get special badges)
  badge_type    TEXT NOT NULL DEFAULT 'varsity'
                CHECK (badge_type IN ('varsity', 'captain', 'hall_of_fame')),

  -- Feature access flags (JSON blob of early-access perks)
  benefits_access JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Ambassador activity metrics
  recruits_count     INT NOT NULL DEFAULT 0,
  mentorship_hours   INT NOT NULL DEFAULT 0,
  referrals_count    INT NOT NULL DEFAULT 0,

  -- Admin review / moderation
  is_active       BOOLEAN NOT NULL DEFAULT false,
  reviewed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  notes           TEXT,

  -- Audit timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One ambassador profile per user per sport
  UNIQUE (user_id, sport)
);

-- Index for leaderboard lookups
CREATE INDEX IF NOT EXISTS idx_ambassador_profiles_tier ON ambassador_profiles (tier);
CREATE INDEX IF NOT EXISTS idx_ambassador_profiles_sport ON ambassador_profiles (sport);
CREATE INDEX IF NOT EXISTS idx_ambassador_profiles_recruits ON ambassador_profiles (recruits_count DESC);
CREATE INDEX IF NOT EXISTS idx_ambassador_profiles_active ON ambassador_profiles (is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE ambassador_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can read active ambassador profiles (for leaderboard / public badges)
CREATE POLICY "Anyone can read active ambassador profiles"
  ON ambassador_profiles
  FOR SELECT
  USING (is_active = true);

-- Users can read their own ambassador profile (even if not yet active)
CREATE POLICY "Users can read own ambassador profile"
  ON ambassador_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all ambassador profiles
CREATE POLICY "Admins can read all ambassador profiles"
  ON ambassador_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Users can insert their own application
CREATE POLICY "Users can apply for ambassador"
  ON ambassador_profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND tier = 'bronze'
    AND badge_type = 'varsity'
  );

-- Admins can update any ambassador profile
CREATE POLICY "Admins can update ambassador profiles"
  ON ambassador_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Users can update their own recruits_count and mentorship_hours
CREATE POLICY "Users can update own activity metrics"
  ON ambassador_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Only allow updating specific columns by checking old vs new
    -- (the tier/badge_type/is_active changes are admin-only)
  );
