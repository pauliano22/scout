-- Migration 018: Alumni self-serve fields, profile claiming, and account_role on signup.
--
-- Adds the columns the alumni claim wizard writes to, a public storage bucket
-- for profile photos, and extends handle_new_user() so the role chosen at signup
-- (passed via auth metadata) is honored on profile creation.

-- =========================================================
-- 1. Alumni: self-serve + claim columns
-- =========================================================

ALTER TABLE alumni
  ADD COLUMN IF NOT EXISTS bio                          text,
  ADD COLUMN IF NOT EXISTS advice                       text,
  ADD COLUMN IF NOT EXISTS share_email_with_students    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_claimed                   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_at                   timestamptz,
  ADD COLUMN IF NOT EXISTS claim_source                 text,
  ADD COLUMN IF NOT EXISTS claimed_by_user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_reviewed_by_alumni   boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_alumni_is_claimed
  ON alumni(is_claimed) WHERE is_claimed;

CREATE INDEX IF NOT EXISTS idx_alumni_claimed_by_user
  ON alumni(claimed_by_user_id) WHERE claimed_by_user_id IS NOT NULL;

-- Backfill: existing rows that have a profile linked through profiles.alumni_id
-- count as claimed via the legacy email-match path.
UPDATE alumni a
SET
  is_claimed = true,
  claimed_at = COALESCE(a.claimed_at, a.updated_at),
  claim_source = COALESCE(a.claim_source, 'opt_in'),
  claimed_by_user_id = COALESCE(a.claimed_by_user_id, p.id),
  profile_reviewed_by_alumni = true
FROM profiles p
WHERE p.alumni_id = a.id
  AND a.is_claimed = false;

-- =========================================================
-- 2. handle_new_user(): honor account_role from signup metadata
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
  v_account_role user_role;
BEGIN
  v_role := lower(coalesce(NEW.raw_user_meta_data->>'account_role', 'student'));
  IF v_role NOT IN ('student', 'alumni') THEN
    v_role := 'student';
  END IF;
  v_account_role := v_role::user_role;

  INSERT INTO public.profiles (id, email, full_name, account_role, is_alumni)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_account_role,
    v_account_role = 'alumni'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists from migration 001; recreate to make sure it points at the new body.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- 3. Storage bucket for alumni profile photos
-- =========================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'alumni-photos',
  'alumni-photos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public            = EXCLUDED.public,
      file_size_limit   = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Authenticated users can upload to a folder named after their auth uid.
DROP POLICY IF EXISTS "Alumni can upload own photo" ON storage.objects;
CREATE POLICY "Alumni can upload own photo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'alumni-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Alumni can update own photo" ON storage.objects;
CREATE POLICY "Alumni can update own photo"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'alumni-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'alumni-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Alumni can delete own photo" ON storage.objects;
CREATE POLICY "Alumni can delete own photo"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'alumni-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read: photos render in student-facing alumni cards.
DROP POLICY IF EXISTS "Alumni photos are publicly readable" ON storage.objects;
CREATE POLICY "Alumni photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'alumni-photos');
