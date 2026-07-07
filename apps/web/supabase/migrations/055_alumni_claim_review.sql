-- Migration 055: track the review state of an alumni profile claim.
--
-- A claim whose submitted name matches the roster is auto-accepted; an unmatched
-- name is held for admin review. This column is the queue:
--   'pending'  → hidden (is_public=false), waiting for admin approve/reject
--   'approved' → published + the claimant granted directory_access
--   'rejected' → stays hidden
-- NULL for rows that aren't self-service claims (scraped roster rows).
-- See /api/alumni/claim (writes it) and /api/admin/claims (reviews it).

BEGIN;

ALTER TABLE public.alumni
  ADD COLUMN IF NOT EXISTS claim_review_status text
  CHECK (claim_review_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_alumni_claim_pending
  ON public.alumni(claim_review_status) WHERE claim_review_status = 'pending';

COMMIT;
