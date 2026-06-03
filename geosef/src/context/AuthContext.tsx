import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { OAUTH_CLIENT_ID } from '../config';

export interface User {
  email: string;
  name: string;
  picture: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, token: null, signIn: () => {}, signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function parseJwt(token: string): Record<string, unknown> {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
}

function loadGIS(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Module-level guard so React StrictMode's double-mount in dev doesn't trigger
// "google.accounts.id.initialize() is called multiple times" warnings.
let gisInitialized = false;

// Google ID tokens last ~1h and can't be refreshed — the only renewal is to
// silently re-mint one via One Tap auto-select. Do that this many ms before the
// real expiry so backend calls (which re-verify the token) never hit a stale one.
const REFRESH_LEAD_MS = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearRefresh() {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }

  // Ask GIS for a fresh credential. With auto_select set plus an active Google
  // session and prior consent, this re-fires `callback` with no visible UI.
  function silentRefresh() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google?.accounts?.id?.prompt();
  }

  function scheduleRefresh(expMs: number) {
    clearRefresh();
    const delay = Math.max(0, expMs - Date.now() - REFRESH_LEAD_MS);
    refreshTimer.current = setTimeout(silentRefresh, delay);
  }

  function applyCredential(credential: string) {
    const claims = parseJwt(credential);
    const expMs = (claims.exp as number) * 1000;
    if (!expMs || expMs < Date.now()) {
      localStorage.removeItem('authToken');
      // Stored token is stale — try a silent re-auth rather than dropping the
      // user straight to signed-out.
      silentRefresh();
      return;
    }
    setUser({
      email: claims.email as string,
      name: claims.name as string,
      picture: claims.picture as string,
    });
    setToken(credential);
    localStorage.setItem('authToken', credential);
    scheduleRefresh(expMs);
    // Dismiss any active GIS overlay (one-tap, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google?.accounts?.id?.cancel?.();
  }

  useEffect(() => {
    if (!OAUTH_CLIENT_ID) {
      // No client id (e.g. local dev without it): still honor a stored token,
      // but there's no GIS to refresh it with.
      const stored = localStorage.getItem('authToken');
      if (stored) applyCredential(stored);
      return;
    }

    loadGIS().then(() => {
      if (!gisInitialized) {
        gisInitialized = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).google.accounts.id.initialize({
          client_id: OAUTH_CLIENT_ID,
          auto_select: true, // silently re-sign returning users with one session
          itp_support: true, // keep One Tap working under Safari ITP
          callback: (response: { credential: string }) => applyCredential(response.credential),
        });
      }
      // Apply after init so the expired-token path can fall through to a silent
      // refresh, and so the refresh timer's prompt() has GIS available.
      const stored = localStorage.getItem('authToken');
      if (stored) applyCredential(stored);
      else silentRefresh(); // auto_select may sign a returning user back in
    }).catch(() => {});

    return clearRefresh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function signIn() {
    silentRefresh();
  }

  function signOut() {
    clearRefresh();
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google?.accounts?.id?.disableAutoSelect?.();
  }

  return (
    <AuthContext.Provider value={{ user, token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
