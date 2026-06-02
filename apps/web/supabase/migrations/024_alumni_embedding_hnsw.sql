-- =====================================================================
-- Migration 024 — Alumni semantic-search: IVFFlat → HNSW
-- =====================================================================
-- WHY: migration 023 indexed `alumni.embedding` with IVFFlat (lists=100).
-- With the default `ivfflat.probes = 1`, every query scanned exactly ONE of
-- 100 lists (~170 of 16,970 rows). Measured on the live corpus (2026-06-01):
-- many valid queries returned ZERO candidates ("M&A attorneys at top firms",
-- "Software engineers in Austin" → 0 rows), recall routinely returned <
-- match_count, and a 30-phrase sweep reached only ~389 of 16,965 alumni (~2%).
--
-- We could not fix IVFFlat in place: raising recall needs `ivfflat.probes`,
-- and Supabase's dashboard `postgres` role is DENIED that parameter (ERROR
-- 42501) — and production calls (PostgREST as `authenticated`) can't set
-- session GUCs per request anyway. Exact search (dropping the index) gave
-- perfect recall but ran 6–10s and tripped the statement timeout.
--
-- FIX: HNSW. Its graph walk gives near-exact recall at sub-second latency, and
-- — crucially — it's good at its DEFAULT `hnsw.ef_search` (40), so it needs no
-- per-query parameter (which the role couldn't set anyway). The existing
-- `match_alumni_semantic` RPC (mig 023) is index-agnostic — orders by
-- `embedding <=> query` — so NO function change is needed.
--
-- Verified 2026-06-02: build 75.6s; "smart people in tech", "M&A attorneys",
-- "Finance in NY", "Software engineers in Austin" all return real matches;
-- query latency ~0.7–1.1s warm (~3s cold first hit).
--
-- ── HOW THIS WAS APPLIED (important) ────────────────────────────────────────
-- The HNSW build does NOT fit the Supabase SQL Editor: the dashboard hit an
-- upstream (HTTP gateway) timeout, and a parallel build hit ERROR 53100
-- (shared-memory exhaustion) on the small instance. It MUST be run over a
-- DIRECT connection (session pooler / psql / a pg client), with parallel build
-- DISABLED. The three SET lines below are what make it succeed:
--   SET max_parallel_maintenance_workers = 0   -- avoids ERROR 53100
--   SET maintenance_work_mem = '256MB'         -- safe on a small instance
--   SET statement_timeout = '30min'            -- no gateway cap on a direct conn
-- Do NOT use CREATE INDEX CONCURRENTLY (a disconnect would leave an INVALID
-- index). The build is transactional as written.

CREATE EXTENSION IF NOT EXISTS vector;

SET max_parallel_maintenance_workers = 0;
SET maintenance_work_mem = '256MB';
SET statement_timeout = '30min';

DROP INDEX IF EXISTS public.idx_alumni_embedding;        -- old IVFFlat
DROP INDEX IF EXISTS public.idx_alumni_embedding_hnsw;   -- idempotent re-run

CREATE INDEX IF NOT EXISTS idx_alumni_embedding_hnsw
  ON public.alumni
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
