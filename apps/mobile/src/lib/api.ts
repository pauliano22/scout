import { supabase } from './supabase';

// Base URL for apps/web API routes. Set EXPO_PUBLIC_WEB_API_URL in your .env
// (e.g. https://yourapp.vercel.app) for production/staging builds.
export const WEB_API_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_API_URL ?? 'http://localhost:3000';

/** Fetch an apps/web API route with the current session's bearer token. */
export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(`${WEB_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Kick off the agentic campaign from onboarding-saved preferences. Safe to call
 * any time: no-ops when a campaign is already configured, and resolves false
 * (never throws) when the profile is too thin or the network fails.
 */
export async function autostartCampaign(): Promise<boolean> {
  try {
    const res = await authedFetch('/api/campaign/autostart', { method: 'POST' });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}
