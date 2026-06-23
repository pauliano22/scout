-- Add completion_score column to alumni table for profile completion scoring.
-- Score is computed by the application and stored for efficient querying/filtering.

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS completion_score INTEGER DEFAULT 0;

COMMENT ON COLUMN alumni.completion_score IS 'Profile completeness score 0–100. Computed by calculateCompletionScore() in apps/web/lib/profile-completion.ts.';
