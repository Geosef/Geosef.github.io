import { useCallback, useEffect, useState } from 'react';

/**
 * Theme state, shared via the document's `data-theme` attribute.
 *
 * The attribute is set on first paint by an inline bootstrap in index.html
 * (so there's no flash of the wrong theme). This hook reads it, lets any
 * component flip it, and keeps every hook instance in sync via a
 * MutationObserver — so the subnav toggle and, say, the chart recolor together.
 *
 * The user's preference ('light' | 'dark' | 'system') lives in its own
 * localStorage key, independent of the Google-auth-backed favorites prefs:
 * theme must work for logged-out visitors and apply before React mounts.
 */
type ThemePref = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

const KEY = 'theme';

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function resolvePref(pref: ThemePref): Resolved {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

function currentResolved(): Resolved {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const [resolved, setResolved] = useState<Resolved>(currentResolved);

  useEffect(() => {
    const obs = new MutationObserver(() => setResolved(currentResolved()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Track OS changes while the preference is 'system' (no explicit override stored).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (!localStorage.getItem(KEY)) {
        document.documentElement.setAttribute('data-theme', systemPrefersDark() ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setPref = useCallback((pref: ThemePref) => {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
    document.documentElement.setAttribute('data-theme', resolvePref(pref));
  }, []);

  const toggle = useCallback(() => {
    setPref(currentResolved() === 'dark' ? 'light' : 'dark');
  }, [setPref]);

  return { resolved, setPref, toggle };
}
