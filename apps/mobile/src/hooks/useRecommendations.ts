import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchRecommendations,
  recordSwipe,
  type ScoredAlumni,
} from '../services/recommendations';
import {
  DAILY_LIMIT,
  getDailySwipeCount,
  incrementSwipeCount,
} from '../services/dailyLimit';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';

export function useRecommendations() {
  const { user } = useAuth();
  const { prefs, prefsVersion, loaded: prefsLoaded } = usePreferences();
  const [deck, setDeck] = useState<ScoredAlumni[]>([]);
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const lastLoadedVersion = useRef<number | null>(null);
  const lastLoadedUserId = useRef<string | null>(null);

  // Restore limit state on mount so returning users don't see stale UI.
  useEffect(() => {
    getDailySwipeCount().then((count) => {
      if (count >= DAILY_LIMIT) setLimitReached(true);
    });
  }, []);

  const load = useCallback(async () => {
    if (!user || !prefsLoaded) return;
    setLoading(true);
    try {
      const results = await fetchRecommendations(user.id, prefs);
      setDeck(results);
      lastLoadedVersion.current = prefsVersion;
      lastLoadedUserId.current = user.id;
    } finally {
      setLoading(false);
    }
  }, [user, prefs, prefsVersion, prefsLoaded]);

  // Auto-refetch whenever prefs change (and on first load).
  // Debounced so rapid chip-toggling doesn't fire multiple fetches.
  useEffect(() => {
    if (!user || !prefsLoaded) return;
    if (
      lastLoadedUserId.current === user.id &&
      lastLoadedVersion.current === prefsVersion
    ) {
      return;
    }
    const isFirstLoad = lastLoadedUserId.current !== user.id;
    const t = setTimeout(load, isFirstLoad ? 0 : 250);
    return () => clearTimeout(t);
  }, [user, prefsLoaded, prefsVersion, load]);

  const swipe = useCallback(
    async (alumniId: string, action: 'save' | 'pass') => {
      if (!user) return;
      setDeck((prev) => prev.filter((a) => a.id !== alumniId));
      await recordSwipe(user.id, alumniId, action);
      const newCount = await incrementSwipeCount();
      if (newCount >= DAILY_LIMIT) setLimitReached(true);
    },
    [user],
  );

  return { deck, loading, prefs, load, swipe, limitReached };
}
