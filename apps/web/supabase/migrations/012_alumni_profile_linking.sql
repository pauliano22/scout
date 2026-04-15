-- Migration 012: Alumni Profile Linking
-- When an alumni signs up, link their profile to the alumni table row
-- so we don't create duplicate entries.

-- ============================================
-- 1. Add alumni_id foreign key to profiles
-- ============================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS alumni_id UUID REFERENCES alumni(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_alumni_id ON profiles(alumni_id);

-- ============================================
-- 2. Function: auto-link profile to alumni on signup
-- Called by a trigger on auth.users insert, or manually
-- after profile creation.
-- Matches by email (most reliable identifier).
-- ============================================

CREATE OR REPLACE FUNCTION link_profile_to_alumni()
RETURNS TRIGGER AS $$
DECLARE
  v_alumni_id UUID;
  v_sport TEXT;
  v_graduation_year INTEGER;
  v_company TEXT;
  v_role TEXT;
BEGIN
  -- Try to find a matching alumni row by email
  SELECT id, sport, graduation_year, company, role
  INTO v_alumni_id, v_sport, v_graduation_year, v_company, v_role
  FROM alumni
  WHERE email = NEW.email
  LIMIT 1;

  IF v_alumni_id IS NOT NULL THEN
    -- Link the profile to the alumni row
    NEW.alumni_id := v_alumni_id;

    -- Pre-fill any missing profile fields from alumni data
    IF NEW.sport IS NULL AND v_sport IS NOT NULL THEN
      NEW.sport := v_sport;
    END IF;

    IF NEW.graduation_year IS NULL AND v_graduation_year IS NOT NULL THEN
      NEW.graduation_year := v_graduation_year;
    END IF;

    -- Mark the alumni as verified since they've created an account
    UPDATE alumni
    SET is_verified = true
    WHERE id = v_alumni_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. Trigger: run on profile insert
-- ============================================

DROP TRIGGER IF EXISTS trigger_link_profile_to_alumni ON profiles;
CREATE TRIGGER trigger_link_profile_to_alumni
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION link_profile_to_alumni();

-- ============================================
-- 4. Backfill: link any existing profiles that
-- match an alumni row by email
-- ============================================

UPDATE profiles p
SET alumni_id = a.id
FROM alumni a
WHERE p.email = a.email
  AND p.alumni_id IS NULL
  AND a.email IS NOT NULL;

-- Mark those alumni as verified
UPDATE alumni a
SET is_verified = true
FROM profiles p
WHERE p.alumni_id = a.id;
