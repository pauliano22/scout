-- Enable RLS on reported_content (was created without policies)
-- Authenticated users can insert flagged content, admins can read/manage

ALTER TABLE reported_content ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to insert a report
CREATE POLICY "Users can insert reports"
  ON reported_content
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to see their own reports
CREATE POLICY "Users can view their own reports"
  ON reported_content
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to manage all reports
CREATE POLICY "Admins can manage all reports"
  ON reported_content
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.account_role = 'admin')
    )
  );
