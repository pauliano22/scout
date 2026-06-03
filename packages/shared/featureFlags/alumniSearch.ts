// Deterministic A/B bucketing for the conversational alumni-search rollout.
//
// Lives in @scout/shared so the web route handler and the mobile client
// always agree on who is in the treatment arm. Previously duplicated in
// apps/web/lib/search/featureFlag.ts and apps/mobile/src/lib/featureFlag.ts —
// drift was a footgun. One copy, both apps import it.

// Rollout TEMPORARILY OFF (0%). Prod is missing OPENAI_API_KEY, so the search
// pipeline (embeddings/parse/rerank) errors there — at 0% everyone gets the
// control /plan (PlanClient) instead of the broken search. Re-enable by
// setting this back to 100 (or set ALUMNI_SEARCH_ROLLOUT_PERCENT=100 in the
// prod env) once the OpenAI key is configured in Vercel. The env override
// works in both runtimes because it's plain process.env.
const envPct = Number(
  process.env.ALUMNI_SEARCH_ROLLOUT_PERCENT ??
  process.env.EXPO_PUBLIC_ALUMNI_SEARCH_ROLLOUT_PERCENT,
);
export const ALUMNI_SEARCH_ROLLOUT_PERCENT = Number.isFinite(envPct) ? envPct : 0;

// 32-bit FNV-1a — fast, no deps, stable across runtimes.
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function isInAlumniSearchTreatment(
  userId: string | null | undefined,
  rolloutPercent: number = ALUMNI_SEARCH_ROLLOUT_PERCENT,
): boolean {
  if (!userId) return false;
  const bucket = fnv1a(`alumni-search:${userId}`) % 100;
  return bucket < clamp(rolloutPercent, 0, 100);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
