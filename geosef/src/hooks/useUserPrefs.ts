import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPrefs, setPrefs, loadCachedPrefs, saveCachedPrefs } from '../services/userPrefs';
import type { UserPrefs } from '../types/golf';

type FavKey = 'favoritePlayers' | 'favoriteCourses';

export function useUserPrefs() {
  const { user, token, signIn } = useAuth();
  const [prefs, setPrefsState] = useState<UserPrefs | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const isSignedIn = !!(user && token);

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
        setPrefsState(fresh);
        saveCachedPrefs(user.email, fresh);
      })
      .catch(err => {
        console.warn('[favorites] sync failed:', err.message);
      })
      .finally(() => setIsLoaded(true));
  }, [user?.email, token]);

  const toggleFavorite = useCallback(async (key: FavKey, name: string) => {
    if (!user || !token || !prefs) return;
    const prev = prefs;
    const inList = prev[key].includes(name);
    const updated: UserPrefs = {
      ...prev,
      [key]: inList ? prev[key].filter(n => n !== name) : [name, ...prev[key]],
    };
    setPrefsState(updated);
    saveCachedPrefs(user.email, updated);
    try {
      await setPrefs(token, updated);
    } catch (err) {
      console.warn('[favorites] save failed:', (err as Error).message);
      // Roll the optimistic change back and surface it to the user.
      setPrefsState(prev);
      saveCachedPrefs(user.email, prev);
      setSaveError(true);
    }
  }, [user, token, prefs]);

  const toggleFavoritePlayer = useCallback(
    (name: string) => toggleFavorite('favoritePlayers', name),
    [toggleFavorite],
  );
  const toggleFavoriteCourse = useCallback(
    (name: string) => toggleFavorite('favoriteCourses', name),
    [toggleFavorite],
  );
  const clearSaveError = useCallback(() => setSaveError(false), []);

  return {
    prefs,
    isLoaded,
    isSignedIn,
    signIn,
    toggleFavoritePlayer,
    toggleFavoriteCourse,
    saveError,
    clearSaveError,
  };
}
