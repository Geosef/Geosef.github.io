import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPrefs, setPrefs, loadCachedPrefs, saveCachedPrefs } from '../services/userPrefs';
import type { UserPrefs } from '../types/golf';

export function useUserPrefs() {
  const { user, token } = useAuth();
  const [prefs, setPrefsState] = useState<UserPrefs | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      setPrefsState(null);
      setIsLoaded(true);
      return;
    }

    const cached = loadCachedPrefs(user.email);
    // Always start with valid empty arrays so consumers never see undefined
    setPrefsState(cached ?? { favoritePlayers: [], favoriteCourses: [] });
    if (cached) setIsLoaded(true);

    getPrefs(token)
      .then(fresh => {
        // Ignore error responses (e.g. { error: 'Unauthorized' })
        if (!Array.isArray(fresh.favoritePlayers)) return;
        setPrefsState(fresh);
        saveCachedPrefs(user.email, fresh);
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, [user?.email, token]);

  const toggleFavoritePlayer = useCallback(async (name: string) => {
    if (!user || !token || !prefs) return;
    const prev = prefs;
    const inList = prev.favoritePlayers.includes(name);
    const updated: UserPrefs = {
      ...prev,
      favoritePlayers: inList
        ? prev.favoritePlayers.filter(p => p !== name)
        : [name, ...prev.favoritePlayers],
    };
    setPrefsState(updated);
    saveCachedPrefs(user.email, updated);
    try {
      await setPrefs(token, updated);
    } catch {
      setPrefsState(prev);
      saveCachedPrefs(user.email, prev);
    }
  }, [user, token, prefs]);

  const toggleFavoriteCourse = useCallback(async (name: string) => {
    if (!user || !token || !prefs) return;
    const prev = prefs;
    const inList = prev.favoriteCourses.includes(name);
    const updated: UserPrefs = {
      ...prev,
      favoriteCourses: inList
        ? prev.favoriteCourses.filter(c => c !== name)
        : [name, ...prev.favoriteCourses],
    };
    setPrefsState(updated);
    saveCachedPrefs(user.email, updated);
    try {
      await setPrefs(token, updated);
    } catch {
      setPrefsState(prev);
      saveCachedPrefs(user.email, prev);
    }
  }, [user, token, prefs]);

  return { prefs, toggleFavoritePlayer, toggleFavoriteCourse, isLoaded };
}
