-- Migration 010: Add enrichment fields to alumni table
-- Adds work_history, skills, education from LinkedIn data

ALTER TABLE alumni
  ADD COLUMN IF NOT EXISTS work_history JSONB,
  ADD COLUMN IF NOT EXISTS skills TEXT[],
  ADD COLUMN IF NOT EXISTS education JSONB;
