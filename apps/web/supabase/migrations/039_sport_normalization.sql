-- ============================================================
-- Migration 035: Sport Name Normalization & Alias Resolution
-- ============================================================
-- Creates a sport_normalization lookup table that maps free-text
-- sport name variants to canonical sport entries with category,
-- contact type, and competition level metadata.
-- ============================================================

-- 1. Sport category enum
DO $$ BEGIN
  CREATE TYPE sport_category AS ENUM ('team', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Sport contact type enum
DO $$ BEGIN
  CREATE TYPE sport_contact_type AS ENUM ('contact', 'non-contact');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Sport level enum
DO $$ BEGIN
  CREATE TYPE sport_level AS ENUM ('varsity', 'club', 'intramural');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Sport normalization lookup table
CREATE TABLE IF NOT EXISTS sport_normalization (
  canonical_name  TEXT PRIMARY KEY,
  aliases         TEXT[] NOT NULL DEFAULT '{}',
  category        sport_category NOT NULL,
  contact_type    sport_contact_type NOT NULL,
  level           sport_level NOT NULL DEFAULT 'varsity',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on aliases for fast lookup (using GIN for array containment)
CREATE INDEX IF NOT EXISTS idx_sport_normalization_aliases ON sport_normalization USING GIN (aliases);

-- 5. Seed canonical Cornell sports data
-- ============================================================
-- Varsity Sports (team / contact)
-- ============================================================
INSERT INTO sport_normalization (canonical_name, aliases, category, contact_type, level) VALUES
  ('Football', ARRAY['football', 'cornell football', 'big red football'], 'team', 'contact', 'varsity'),
  ('Baseball', ARRAY['baseball', 'cornell baseball', 'big red baseball'], 'team', 'contact', 'varsity'),
  ('Softball', ARRAY['softball', 'cornell softball', 'big red softball'], 'team', 'contact', 'varsity'),
  ('Wrestling', ARRAY['wrestling', 'cornell wrestling', 'big red wrestling', 'mens wrestling'], 'team', 'contact', 'varsity'),
  ('Men''s Ice Hockey', ARRAY['mens ice hockey', 'mens hockey', 'men''s hockey', 'm hockey', 'hockey - men', 'hockey', 'ice hockey', 'cornell hockey', 'big red hockey'], 'team', 'contact', 'varsity'),
  ('Women''s Ice Hockey', ARRAY['womens ice hockey', 'womens hockey', 'women''s hockey', 'w hockey', 'hockey - women', 'cornell womens hockey'], 'team', 'contact', 'varsity'),
  ('Men''s Lacrosse', ARRAY['mens lacrosse', 'men''s lacrosse', 'm lacrosse', 'lacrosse - men', 'lacrosse mens', 'cornell lacrosse'], 'team', 'contact', 'varsity'),
  ('Women''s Lacrosse', ARRAY['womens lacrosse', 'women''s lacrosse', 'w lacrosse', 'lacrosse - women', 'lacrosse womens', 'cornell womens lacrosse'], 'team', 'contact', 'varsity'),
  ('Men''s Soccer', ARRAY['mens soccer', 'men''s soccer', 'm soccer', 'soccer - men', 'soccer mens', 'cornell soccer'], 'team', 'contact', 'varsity'),
  ('Women''s Soccer', ARRAY['womens soccer', 'women''s soccer', 'w soccer', 'soccer - women', 'soccer womens', 'cornell womens soccer'], 'team', 'contact', 'varsity'),
  ('Men''s Basketball', ARRAY['mens basketball', 'men''s basketball', 'm basketball', 'basketball - men', 'basketball mens', 'mens bball', 'basketball', 'cornell basketball', 'cornell mens basketball'], 'team', 'contact', 'varsity'),
  ('Women''s Basketball', ARRAY['womens basketball', 'women''s basketball', 'w basketball', 'basketball - women', 'basketball womens', 'womens bball', 'cornell womens basketball'], 'team', 'contact', 'varsity'),
  ('Men''s Polo', ARRAY['mens polo', 'men''s polo', 'm polo', 'polo - men', 'polo', 'cornell polo'], 'team', 'contact', 'varsity'),
  ('Women''s Polo', ARRAY['womens polo', 'women''s polo', 'w polo', 'polo - women'], 'team', 'contact', 'varsity'),
  ('Men''s Squash', ARRAY['mens squash', 'men''s squash', 'm squash', 'squash', 'squash - men', 'cornell squash'], 'team', 'non-contact', 'varsity'),
  ('Women''s Squash', ARRAY['womens squash', 'women''s squash', 'w squash', 'squash - women', 'cornell womens squash'], 'team', 'non-contact', 'varsity'),
  ('Men''s Volleyball', ARRAY['mens volleyball', 'men''s volleyball', 'm volleyball', 'volleyball', 'volleyball - men'], 'team', 'non-contact', 'club'),
  ('Women''s Volleyball', ARRAY['womens volleyball', 'women''s volleyball', 'w volleyball', 'volleyball - women'], 'team', 'non-contact', 'varsity'),
-- ============================================================
-- Varsity Sports (team / non-contact)
-- ============================================================
  ('Field Hockey', ARRAY['field hockey', 'cornell field hockey'], 'team', 'non-contact', 'varsity'),
  ('Women''s Gymnastics', ARRAY['womens gymnastics', 'women''s gymnastics', 'gymnastics', 'cornell gymnastics'], 'team', 'non-contact', 'varsity'),
  ('Women''s Sailing', ARRAY['womens sailing', 'women''s sailing', 'sailing', 'cornell sailing', 'sailing - women'], 'team', 'non-contact', 'varsity'),
  ('Women''s Rowing', ARRAY['womens rowing', 'women''s rowing', 'w rowing', 'rowing - women', 'rowing womens'], 'team', 'non-contact', 'varsity'),
  ('Men''s Rowing', ARRAY['mens rowing', 'men''s rowing', 'm rowing', 'rowing - men', 'rowing mens', 'rowing', 'cornell rowing'], 'team', 'non-contact', 'varsity'),
-- ============================================================
-- Varsity Sports (individual)
-- ============================================================
  ('Men''s Track & Field', ARRAY['mens track & field', 'men''s track & field', 'mens track and field', 'men''s track and field', 'm track', 'track & field - men', 'track', 'track and field', 'cornell track'], 'individual', 'non-contact', 'varsity'),
  ('Women''s Track & Field', ARRAY['womens track & field', 'women''s track & field', 'womens track and field', 'women''s track and field', 'w track', 'track & field - women'], 'individual', 'non-contact', 'varsity'),
  ('Men''s Cross Country', ARRAY['mens cross country', 'men''s cross country', 'm cross country', 'cross country', 'cross country - men', 'cornell cross country', 'xc'], 'individual', 'non-contact', 'varsity'),
  ('Women''s Cross Country', ARRAY['womens cross country', 'women''s cross country', 'w cross country', 'cross country - women', 'cornell womens cross country'], 'individual', 'non-contact', 'varsity'),
  ('Men''s Tennis', ARRAY['mens tennis', 'men''s tennis', 'm tennis', 'tennis', 'tennis - men', 'tennis mens', 'cornell tennis'], 'individual', 'non-contact', 'varsity'),
  ('Women''s Tennis', ARRAY['womens tennis', 'women''s tennis', 'w tennis', 'tennis - women', 'tennis womens', 'cornell womens tennis'], 'individual', 'non-contact', 'varsity'),
  ('Men''s Golf', ARRAY['mens golf', 'men''s golf', 'm golf', 'golf', 'golf - men', 'cornell golf'], 'individual', 'non-contact', 'varsity'),
  ('Men''s Swimming & Diving', ARRAY['mens swimming & diving', 'men''s swimming & diving', 'mens swimming and diving', 'men''s swimming and diving', 'm swimming', 'swimming', 'swimming & diving', 'swimming and diving', 'cornell swimming'], 'individual', 'non-contact', 'varsity'),
  ('Women''s Swimming & Diving', ARRAY['womens swimming & diving', 'women''s swimming & diving', 'womens swimming and diving', 'women''s swimming and diving', 'w swimming', 'swimming - women', 'cornell womens swimming'], 'individual', 'non-contact', 'varsity'),
  ('Women''s Fencing', ARRAY['womens fencing', 'women''s fencing', 'fencing', 'fencing - women', 'cornell fencing'], 'individual', 'contact', 'varsity'),
  ('Men''s Fencing', ARRAY['mens fencing', 'men''s fencing', 'fencing - men', 'cornell mens fencing'], 'individual', 'contact', 'varsity')
ON CONFLICT (canonical_name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  contact_type = EXCLUDED.contact_type,
  level = EXCLUDED.level,
  updated_at = now();

-- 6. updated_at trigger
CREATE OR REPLACE FUNCTION update_sport_normalization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sport_normalization_updated_at ON sport_normalization;
CREATE TRIGGER trigger_update_sport_normalization_updated_at
  BEFORE UPDATE ON sport_normalization
  FOR EACH ROW
  EXECUTE FUNCTION update_sport_normalization_updated_at();

-- 7. Row-level security
ALTER TABLE sport_normalization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sport_normalization public read"
  ON sport_normalization FOR SELECT
  USING (true);

CREATE POLICY "sport_normalization admin write"
  ON sport_normalization FOR ALL
  USING (auth_is_admin()) WITH CHECK (auth_is_admin());
