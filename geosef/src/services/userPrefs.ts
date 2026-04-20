import { APPS_SCRIPT_URL } from '../config';
import type { UserPrefs } from '../types/golf';

export function loadCachedPrefs(email: string): UserPrefs | null {
  try {
    const raw = localStorage.getItem(`prefs:${email}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCachedPrefs(email: string, prefs: UserPrefs) {
  localStorage.setItem(`prefs:${email}`, JSON.stringify(prefs));
}

export async function getPrefs(token: string): Promise<UserPrefs> {
  const res = await fetch(`${APPS_SCRIPT_URL}?action=getPrefs&token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(`getPrefs ${res.status}`);
  return res.json();
}

export async function setPrefs(token: string, prefs: UserPrefs): Promise<void> {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    // text/plain avoids CORS preflight for cross-origin Apps Script requests
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'setPrefs', token, ...prefs }),
  });
  if (!res.ok) throw new Error(`setPrefs ${res.status}`);
}
