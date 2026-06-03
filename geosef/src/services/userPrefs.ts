import { APPS_SCRIPT_URL } from '../config';
import type { UserPrefs } from '../types/golf';

export function loadCachedPrefs(email: string): UserPrefs | null {
  try {
    const raw = localStorage.getItem(`prefs:${email}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Validate shape — stale entries from earlier versions could be malformed
    if (!Array.isArray(parsed?.favoritePlayers) || !Array.isArray(parsed?.favoriteCourses)) {
      localStorage.removeItem(`prefs:${email}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCachedPrefs(email: string, prefs: UserPrefs) {
  localStorage.setItem(`prefs:${email}`, JSON.stringify(prefs));
}

// Apps Script returns errors as HTTP 200 with { error, status } in the body,
// so we have to inspect the JSON to detect failures.
export async function getPrefs(token: string): Promise<UserPrefs> {
  const res = await fetch(`${APPS_SCRIPT_URL}?action=getPrefs&token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(`getPrefs ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(`getPrefs: ${data.error}${data.reason ? ` (${data.reason})` : ''}`);
  return data;
}

// The signed-in user's own roster name, resolved once per session. undefined =
// not yet fetched, null = fetched but no roster match (signed out / not a member).
let myPlayerCache: string | null | undefined;
let myPlayerInflight: Promise<string | null> | null = null;

/**
 * Resolve the signed-in user's league roster name via their verified token.
 * More reliable than matching Google display names, which can differ from roster
 * names (nicknames, middle names, etc.). Cached for the session; transient
 * network failures aren't cached so a later call can retry.
 */
export async function getMyPlayerName(token: string): Promise<string | null> {
  if (myPlayerCache !== undefined) return myPlayerCache;
  if (myPlayerInflight) return myPlayerInflight;
  myPlayerInflight = fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    // text/plain keeps the token out of the URL and avoids a CORS preflight
    // (Apps Script /exec can't answer OPTIONS) — same approach as setPrefs.
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'whoami', token }),
  })
    .then(res => (res.ok ? res.json() : { player: null }))
    .then(data => {
      // 403 / no match → cache null (a real "not a member" answer).
      myPlayerCache = data?.player ? String(data.player) : null;
      return myPlayerCache;
    })
    .catch(() => null) // network error — leave uncached so a remount can retry
    .finally(() => { myPlayerInflight = null; });
  return myPlayerInflight;
}

export async function setPrefs(token: string, prefs: UserPrefs): Promise<void> {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    // text/plain avoids CORS preflight for cross-origin Apps Script requests
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'setPrefs', token, ...prefs }),
  });
  if (!res.ok) throw new Error(`setPrefs ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(`setPrefs: ${data.error}${data.reason ? ` (${data.reason})` : ''}`);
}
