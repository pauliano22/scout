-- Migration 014: Add missing UPDATE policy for resume storage
-- Without this, upsert (re-upload) fails with RLS violation on storage.objects

CREATE POLICY "Users can update own resume"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
