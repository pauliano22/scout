import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchRecommendations,
  recordSwipe,
  undoSwipe,
  type ScoredAlumni,
} from '../services/recommendations';
import {
  DAILY_LIMIT,
  decrementSwipeCount,
  getDailySwipeCount,
  incrementSwipeCount,
} from '../services/dailyLimit';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';

export function useRecommendations() {
  const { user } = useAuth();
  const { prefs, prefsVersion, loaded: prefsLoaded } = usePreferences();
  const [deck, setDeck] = useState<ScoredAlumni[]>([]);
  const [history, setHistory] = useState<
    { alumni: ScoredAlumni; action: 'save' | 'pass' }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [swipeCount, setSwipeCount] = useState(0);
  const lastLoadedVersion = useRef<number | null>(null);
  const lastLoadedUserId = useRef<string | null>(null);

  // Sync the daily count whenever the signed-in user changes, so a new account
  // starts fresh instead of inheriting the previous account's count.
  useEffect(() => {
    if (!user) {
      setSwipeCount(0);
      setLimitReached(false);
      return;
    }
    getDailySwipeCount(user.id).then((count) => {
      setSwipeCount(count);
      setLimitReached(count >= DAILY_LIMIT);
    });
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!user || !prefsLoaded) return;
    setLoading(true);
    try {
      const results = await fetchRecommendations(user.id, prefs);
      setDeck(results);
      setHistory([]); // fresh deck — nothing to rewind into
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
      const swiped = deck.find((a) => a.id === alumniId);
      setDeck((prev) => prev.filter((a) => a.id !== alumniId));
      if (swiped) setHistory((h) => [...h, { alumni: swiped, action }]);
      await recordSwipe(user.id, alumniId, action);
      const newCount = await incrementSwipeCount(user.id);
      setSwipeCount(newCount);
      if (newCount >= DAILY_LIMIT) setLimitReached(true);
    },
    [user, deck],
  );

  const rewind = useCallback(async () => {
    if (!user || history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setDeck((prev) =>
      prev.some((a) => a.id === last.alumni.id) ? prev : [last.alumni, ...prev],
    );
    await undoSwipe(user.id, last.alumni.id, last.action);
    const newCount = await decrementSwipeCount(user.id);
    setSwipeCount(newCount);
    setLimitReached(newCount >= DAILY_LIMIT);
  }, [user, history]);

  return {
    deck,
    loading,
    prefs,
    load,
    swipe,
    rewind,
    canRewind: history.length > 0,
    limitReached,
    swipeCount,
  };
}
