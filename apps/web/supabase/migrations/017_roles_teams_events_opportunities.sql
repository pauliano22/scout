-- Migration 015: Roles, Teams, Events hub, Alumni posting board
-- Introduces explicit user roles, team-level separation (launching with football),
-- an events table with RSVPs, and an alumni-posted opportunities board.

-- =========================================================
-- 1. Enum types
-- =========================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'alumni', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE team_code AS ENUM ('football');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_kind AS ENUM ('networking', 'panel', 'workshop', 'game_day', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_visibility AS ENUM ('team', 'all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rsvp_status AS ENUM ('going', 'maybe', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_kind AS ENUM ('job', 'internship', 'mentorship', 'referral', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 2. Profiles: add role and team columns
-- =========================================================

-- Note: `profiles.role` (text) already exists as the user's job title.
-- The new permission role is stored in `account_role` to avoid collision.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_role user_role NOT NULL DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS team team_code NULL;

-- Backfill account_role for existing rows based on is_alumni flag.
UPDATE profiles
SET account_role = 'alumni'
WHERE is_alumni = true AND account_role = 'student';

-- is_admin convenience generated column (read-only, used by RLS predicates).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean
    GENERATED ALWAYS AS (account_role = 'admin') STORED;

CREATE INDEX IF NOT EXISTS idx_profiles_account_role_team ON profiles(account_role, team);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin;

-- =========================================================
-- 3. Teams reference table (extensible beyond football later)
-- =========================================================

CREATE TABLE IF NOT EXISTS teams (
  code team_code PRIMARY KEY,
  display_name text NOT NULL,
  sport text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO teams (code, display_name, sport)
VALUES ('football', 'Cornell Football', 'Football')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- 4. Events hub
-- =========================================================

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team team_code NULL REFERENCES teams(code) ON DELETE SET NULL,
  kind event_kind NOT NULL DEFAULT 'networking',
  visibility event_visibility NOT NULL DEFAULT 'team',
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text,
  host_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  capacity integer,
  is_cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CHECK (capacity IS NULL OR capacity > 0)
);

CREATE INDEX IF NOT EXISTS idx_events_team_starts_at ON events(team, starts_at);
CREATE INDEX IF NOT EXISTS idx_events_visibility_starts_at ON events(visibility, starts_at);
CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_profile_id);

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status rsvp_status NOT NULL DEFAULT 'going',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_profile ON event_rsvps(profile_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_status ON event_rsvps(event_id, status);

-- =========================================================
-- 5. Alumni posting board (opportunities)
-- =========================================================

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team team_code NULL REFERENCES teams(code) ON DELETE SET NULL,
  kind opportunity_kind NOT NULL DEFAULT 'job',
  title text NOT NULL,
  body text,
  company text,
  location text,
  url text,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_team_active ON opportunities(team, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_posted_by ON opportunities(posted_by);
CREATE INDEX IF NOT EXISTS idx_opportunities_expires_at ON opportunities(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS opportunity_saves (
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_saves_profile ON opportunity_saves(profile_id);

-- =========================================================
-- 6. Role change audit log
-- =========================================================

CREATE TABLE IF NOT EXISTS role_change_log (
  id bigserial PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_role user_role,
  new_role user_role NOT NULL,
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_change_log_profile ON role_change_log(profile_id, changed_at DESC);

CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_role IS DISTINCT FROM OLD.account_role THEN
    INSERT INTO role_change_log (profile_id, old_role, new_role, changed_by)
    VALUES (NEW.id, OLD.account_role, NEW.account_role, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_role_change ON profiles;
CREATE TRIGGER trigger_log_role_change
  AFTER UPDATE OF account_role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_role_change();

-- =========================================================
-- 7. updated_at triggers
-- =========================================================

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_event_rsvps_updated_at
  BEFORE UPDATE ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =========================================================
-- 8. Row-level security
-- =========================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_change_log ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION auth_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- Helper: current user's team (null if none)
CREATE OR REPLACE FUNCTION auth_team() RETURNS team_code
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT team FROM profiles WHERE id = auth.uid();
$$;

-- ---- teams (public read) ----
CREATE POLICY "teams readable by authenticated"
  ON teams FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "teams admin write"
  ON teams FOR ALL
  USING (auth_is_admin()) WITH CHECK (auth_is_admin());

-- ---- events ----
CREATE POLICY "events readable by team or all"
  ON events FOR SELECT USING (
    visibility = 'all'
    OR auth_is_admin()
    OR (visibility = 'team' AND team IS NOT DISTINCT FROM auth_team())
    OR host_profile_id = auth.uid()
  );

CREATE POLICY "events alumni or admin can create"
  ON events FOR INSERT WITH CHECK (
    auth_is_admin()
    OR (
      host_profile_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.account_role IN ('alumni', 'admin')
      )
    )
  );

CREATE POLICY "events host or admin update"
  ON events FOR UPDATE USING (
    auth_is_admin() OR host_profile_id = auth.uid()
  );

CREATE POLICY "events admin delete"
  ON events FOR DELETE USING (auth_is_admin());

-- ---- event_rsvps ----
CREATE POLICY "rsvps readable to self, host, admin"
  ON event_rsvps FOR SELECT USING (
    profile_id = auth.uid()
    OR auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_rsvps.event_id AND e.host_profile_id = auth.uid()
    )
  );

CREATE POLICY "rsvps self upsert"
  ON event_rsvps FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "rsvps self update"
  ON event_rsvps FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "rsvps self delete"
  ON event_rsvps FOR DELETE USING (profile_id = auth.uid() OR auth_is_admin());

-- ---- opportunities ----
CREATE POLICY "opportunities readable by team or admin"
  ON opportunities FOR SELECT USING (
    auth_is_admin()
    OR team IS NULL
    OR team IS NOT DISTINCT FROM auth_team()
    OR posted_by = auth.uid()
  );

CREATE POLICY "opportunities alumni or admin create"
  ON opportunities FOR INSERT WITH CHECK (
    auth_is_admin()
    OR (
      posted_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.account_role IN ('alumni', 'admin')
      )
    )
  );

CREATE POLICY "opportunities owner or admin update"
  ON opportunities FOR UPDATE USING (
    auth_is_admin() OR posted_by = auth.uid()
  );

CREATE POLICY "opportunities owner or admin delete"
  ON opportunities FOR DELETE USING (
    auth_is_admin() OR posted_by = auth.uid()
  );

-- ---- opportunity_saves ----
CREATE POLICY "opportunity_saves self read"
  ON opportunity_saves FOR SELECT USING (
    profile_id = auth.uid() OR auth_is_admin()
  );

CREATE POLICY "opportunity_saves self write"
  ON opportunity_saves FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "opportunity_saves self delete"
  ON opportunity_saves FOR DELETE USING (profile_id = auth.uid());

-- ---- role_change_log (admins only) ----
CREATE POLICY "role_change_log admin read"
  ON role_change_log FOR SELECT USING (auth_is_admin());
