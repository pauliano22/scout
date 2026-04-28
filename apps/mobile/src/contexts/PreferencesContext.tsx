import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  fetchUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from '../services/recommendations';
import { useAuth } from './AuthContext';

const DEFAULT_PREFS: UserPreferences = {
  industries: [],
  sports: [],
  locations: [],
  roles: [],
  companies: [],
  priorities: { sameSport: true, similarIndustry: true, seniorAlumni: false },
};

interface PreferencesContextValue {
  prefs: UserPreferences;
  /** Bumps on every change. Use as a dependency to react to pref edits. */
  prefsVersion: number;
  setPrefs: (updater: (p: UserPreferences) => UserPreferences) => void;
  loaded: boolean;
  saving: boolean;
  lastSavedAt: number | null;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 400;

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [prefs, setPrefsState] = useState<UserPreferences>(DEFAULT_PREFS);
  const [prefsVersion, setPrefsVersion] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load — pull from DB once per user, seed missing fields from profile
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setPrefsState(DEFAULT_PREFS);
      setLoaded(false);
      dirty.current = false;
      return;
    }
    fetchUserPreferences(user.id).then((p) => {
      if (cancelled) return;
      const seeded: UserPreferences = {
        ...p,
        sports:
          p.sports.length === 0 && profile?.sport ? [profile.sport] : p.sports,
        industries:
          p.industries.length === 0 && profile?.primary_industry
            ? [profile.primary_industry]
            : p.industries,
        roles:
          p.roles.length === 0 && profile?.target_roles?.length
            ? profile.target_roles
            : p.roles,
        locations:
          p.locations.length === 0 && profile?.preferred_locations?.length
            ? profile.preferred_locations
            : p.locations,
      };
      setPrefsState(seeded);
      setLoaded(true);
      dirty.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  const setPrefs = useCallback(
    (updater: (p: UserPreferences) => UserPreferences) => {
      setPrefsState((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        dirty.current = true;
        return next;
      });
      setPrefsVersion((v) => v + 1);
    },
    [],
  );

  // Debounced auto-save whenever prefs change after initial load
  useEffect(() => {
    if (!user || !loaded || !dirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await saveUserPreferences(user.id, prefs);
        setLastSavedAt(Date.now());
        dirty.current = false;
      } finally {
        setSaving(false);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [prefs, user, loaded]);

  return (
    <PreferencesContext.Provider
      value={{ prefs, prefsVersion, setPrefs, loaded, saving, lastSavedAt }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return ctx;
}
