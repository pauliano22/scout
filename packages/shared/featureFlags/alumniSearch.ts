// Deterministic A/B bucketing for the conversational alumni-search rollout.
//
// Lives in @scout/shared so the web route handler and the mobile client
// always agree on who is in the treatment arm. Previously duplicated in
// apps/web/lib/search/featureFlag.ts and apps/mobile/src/lib/featureFlag.ts —
// drift was a footgun. One copy, both apps import it.

// Default rollout is 10%. Overridable via env for local testing without
// touching the committed default — set ALUMNI_SEARCH_ROLLOUT_PERCENT=100 (web,
// Node) or EXPO_PUBLIC_ALUMNI_SEARCH_ROLLOUT_PERCENT=100 (mobile, inlined by
// Metro). Unset in prod → 10. The env read works in both runtimes because it's
// plain process.env, not a Next/Expo-specific import.
const envPct = Number(
  process.env.ALUMNI_SEARCH_ROLLOUT_PERCENT ??
  process.env.EXPO_PUBLIC_ALUMNI_SEARCH_ROLLOUT_PERCENT,
);
export const ALUMNI_SEARCH_ROLLOUT_PERCENT = Number.isFinite(envPct) ? envPct : 10;

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
