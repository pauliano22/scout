import { useState, useCallback } from 'react';
import {
  fetchRecommendations,
  fetchUserPreferences,
  recordSwipe,
  type ScoredAlumni,
  type UserPreferences,
} from '../services/recommendations';
import { useAuth } from '../contexts/AuthContext';

export function useRecommendations() {
  const { user, profile } = useAuth();
  const [deck, setDeck] = useState<ScoredAlumni[]>([]);
  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userPrefs = await fetchUserPreferences(user.id);

      // Seed preferences from profile if empty
      const mergedPrefs: UserPreferences = {
        ...userPrefs,
        sports:
          userPrefs.sports.length === 0 && profile?.sport
            ? [profile.sport]
            : userPrefs.sports,
        industries:
          userPrefs.industries.length === 0 && profile?.primary_industry
            ? [profile.primary_industry]
            : userPrefs.industries,
        roles:
          userPrefs.roles.length === 0 && profile?.target_roles?.length
            ? profile.target_roles
            : userPrefs.roles,
        locations:
          userPrefs.locations.length === 0 && profile?.preferred_locations?.length
            ? profile.preferred_locations
            : userPrefs.locations,
      };

      setPrefs(mergedPrefs);
      const results = await fetchRecommendations(user.id, mergedPrefs);
      setDeck(results);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  const swipe = useCallback(
    async (alumniId: string, action: 'save' | 'pass') => {
      if (!user) return;
      // Optimistically remove from deck
      setDeck((prev) => prev.filter((a) => a.id !== alumniId));
      await recordSwipe(user.id, alumniId, action);
    },
    [user],
  );

  return { deck, loading, prefs, load, swipe };
}
