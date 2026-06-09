// Deterministic rollout bucketing for the agentic campaign-home rollout.
//
// Mirrors featureFlags/alumniSearch so web (server components AND the client
// Navbar) agree on who lands on the new home. Reads the rollout percent from
// CAMPAIGN_HOME_ROLLOUT_PERCENT (server) or NEXT_PUBLIC_CAMPAIGN_HOME_ROLLOUT_PERCENT
// (exposed to the client bundle). Default 0 — OFF, so flipping it on/off is a
// single env change and fully reversible. The autonomous loop stays separately
// gated by AGENT_PILOT_USER_IDS; this flag only controls the SURFACE.
const envPct = Number(
  process.env.CAMPAIGN_HOME_ROLLOUT_PERCENT ??
  process.env.NEXT_PUBLIC_CAMPAIGN_HOME_ROLLOUT_PERCENT,
);
export const CAMPAIGN_HOME_ROLLOUT_PERCENT = Number.isFinite(envPct) ? envPct : 0;

// 32-bit FNV-1a — fast, no deps, stable across runtimes (same as alumniSearch).
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function isInCampaignHome(
  userId: string | null | undefined,
  rolloutPercent: number = CAMPAIGN_HOME_ROLLOUT_PERCENT,
): boolean {
  if (!userId) return false;
  const bucket = fnv1a(`campaign-home:${userId}`) % 100;
  return bucket < clamp(rolloutPercent, 0, 100);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
