-- Migration 021: Add avatar_url to profiles + create user-avatars storage bucket.
--
-- avatar_url was already present in the shared type definition but was never
-- added to the actual table. This migration adds the column and sets up
-- the storage bucket student-athletes use to upload profile photos from mobile.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Public bucket — avatars are not sensitive and we need unauthenticated reads
-- (e.g., avatar shown in alumni detail view without session).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Authenticated users may only upload/update inside their own folder ({user_id}/).
CREATE POLICY "user_avatars_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "user_avatars_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "user_avatars_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Anyone (including anon) may read avatars since the bucket is public.
CREATE POLICY "user_avatars_select"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'user-avatars');
