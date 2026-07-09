-- Freshness engine tracking.
-- Records when (and at what confidence) an alum row was last auto-enriched, so the
-- enrichment cron can target the stalest / most-incomplete rows first and skip
-- ones it just touched. Additive and nullable — safe on the existing corpus.

alter table alumni add column if not exists enriched_at timestamptz;
alter table alumni add column if not exists enrichment_confidence real;

-- Stalest-first scan for the incremental enrichment cron (NULLS FIRST = never enriched).
create index if not exists idx_alumni_enriched_at on alumni (enriched_at nulls first);
