-- Migration 063: share_email_with_students defaults to opt-IN (false).
--
-- Migration 018 created this flag as NOT NULL DEFAULT true — an opt-OUT
-- default. That contradicts the pilot DPA promise ("no alumni email addresses
-- or direct contact information shared with students unless the alumni has
-- explicitly opted in"): every scraped/imported row was born consenting to
-- something the alum never saw. Flip the DEFAULT so new rows start
-- non-consenting and consent only ever comes from an explicit alumni action
-- (claim wizard / profile settings, which write the column directly).
--
-- Deliberately NO backfill: existing values are left untouched. Claimed alumni
-- who chose to share keep sharing; enforcement for never-opted-in rows happens
-- at the app egress layer (lib/privacy/sanitizeAlumni.ts, behind
-- ENFORCE_CONTACT_CONSENT) which requires is_claimed = true AND
-- share_email_with_students = true before contact info reaches a student.

ALTER TABLE alumni
  ALTER COLUMN share_email_with_students SET DEFAULT false;

COMMENT ON COLUMN alumni.share_email_with_students IS
  'Opt-IN consent to expose email/contact info to student sessions. Default false (migration 063); only meaningful together with is_claimed = true — unclaimed rows never consented regardless of this value.';
