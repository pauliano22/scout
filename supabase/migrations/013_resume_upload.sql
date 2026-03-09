-- Migration 013: Resume Upload
-- Adds resume fields to profiles table

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS resume_parsed JSONB;

-- Storage bucket for resumes (run this too if the bucket doesn't exist yet)
-- In Supabase dashboard: Storage → New bucket → name: "resumes", private: true
-- Or use the SQL below:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  5242880, -- 5MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can only access their own resume
CREATE POLICY "Users can upload own resume"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own resume"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own resume"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
