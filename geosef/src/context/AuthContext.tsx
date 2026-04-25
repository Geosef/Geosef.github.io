import React, { createContext, useContext, useEffect, useState } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  function applyCredential(credential: string) {
    const claims = parseJwt(credential);
    const exp = (claims.exp as number) * 1000;
    if (exp < Date.now()) {
      localStorage.removeItem('authToken');
      return;
    }
    setUser({
      email: claims.email as string,
      name: claims.name as string,
      picture: claims.picture as string,
    });
    setToken(credential);
    localStorage.setItem('authToken', credential);
    // Dismiss any active GIS overlay (one-tap, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google?.accounts?.id?.cancel?.();
  }

  useEffect(() => {
    const stored = localStorage.getItem('authToken');
    if (stored) applyCredential(stored);

    if (!OAUTH_CLIENT_ID) return;

    loadGIS().then(() => {
      if (gisInitialized) return;
      gisInitialized = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).google.accounts.id.initialize({
        client_id: OAUTH_CLIENT_ID,
        callback: (response: { credential: string }) => applyCredential(response.credential),
      });
    }).catch(() => {});
  }, []);

  function signIn() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google?.accounts?.id?.prompt();
  }

  function signOut() {
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
