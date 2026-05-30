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
