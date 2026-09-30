import { useEffect, useState } from 'react';

/**
 * Which board to render:
 * - `phone`: the interactive /cup board.
 * - `tv`: landscape broadcast board.
 * - `vertical`: 9:16 board with top and bottom bands kept clear for
 *   Instagram Live's overlays.
 * - `portrait`: the vertical board filling a phone held upright, where
 *   those bands aren't needed.
 */
export type BoardLayout = 'phone' | 'tv' | 'vertical' | 'portrait';

/**
 * `?tv` alone follows the screen's shape, so rotating a phone swaps between
 * the portrait and landscape boards. `?tv=landscape` and `?tv=vertical` pin a
 * layout for fixed-size stream captures (OBS, Live Producer).
 */
export function boardLayout(tv: string | null, portrait: boolean): BoardLayout {
  if (tv === null) return 'phone';
  if (tv === 'vertical') return 'vertical';
  if (tv === 'landscape') return 'tv';
  return portrait ? 'portrait' : 'tv';
}

/** Page color behind a view, and whether it's a fixed full-screen board. */
export interface CupSurface {
  background: string;
  /** Full-screen boards: no page scroll or rubber-band overscroll. */
  lock?: boolean;
}

// Hex values mirror the CSS tokens (--hd-cream etc.); Safari reads them off
// html/body directly, so they're set inline rather than through CSS vars.
export const SURFACES = {
  page: { background: '#f8f6ea' },
  tv: { background: '#3f4463', lock: true },
  vertical: { background: '#1d1f2b', lock: true },
} satisfies Record<string, CupSurface>;

export const LAYOUT_SURFACE: Record<BoardLayout, CupSurface> = {
  phone: SURFACES.page,
  tv: SURFACES.tv,
  vertical: SURFACES.vertical,
  portrait: SURFACES.vertical,
};

/** Whether a media query matches; updates as it changes (rotate, resize). */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const usePortrait = () => useMedia('(orientation: portrait)');

/** A phone on its side, where the browser's bars take a big share of the height. */
export const COMPACT_LANDSCAPE = '(orientation: landscape) and (max-height: 500px)';
/** Launched from the Home Screen: no browser bars at all. */
export const STANDALONE = '(display-mode: standalone), (display-mode: fullscreen)';

// Safari only ships the prefixed Fullscreen API on some versions.
type WebkitDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => void };

/** Whether this browser lets a page go full screen (not iPhone Safari, historically). */
export function canFullscreen(): boolean {
  const d = document as WebkitDocument;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

function fullscreenElement(): Element | null {
  const d = document as WebkitDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/** Enters or leaves full screen. Call from a tap. */
export function toggleFullscreen() {
  const d = document as WebkitDocument;
  const el = document.documentElement as WebkitElement;
  if (fullscreenElement()) (d.exitFullscreen?.bind(d) ?? d.webkitExitFullscreen?.bind(d))?.();
  else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else el.webkitRequestFullscreen?.();
}

/** Whether the page is full screen right now. */
export function useFullscreen(): boolean {
  const [on, setOn] = useState(() => !!fullscreenElement());
  useEffect(() => {
    const onChange = () => setOn(!!fullscreenElement());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);
  return on;
}

/**
 * Keeps the screen awake while `on`, for boards left running on a phone or
 * TV. Returns whether the lock is held (false where unsupported or refused).
 *
 * iOS only grants the lock during a tap, and every browser drops it when the
 * page is hidden. So it's requested on mount (enough for desktop and
 * Android), again on each tap until held, and again when the page returns.
 */
export function useWakeLock(on: boolean): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let pending = false;
    let done = false;
    const request = () => {
      if (lock || pending || document.visibilityState !== 'visible') return;
      pending = true;
      navigator.wakeLock.request('screen').then(
        l => {
          pending = false;
          if (done) { l.release(); return; }
          lock = l;
          setHeld(true);
          l.addEventListener('release', () => {
            lock = null;
            if (!done) setHeld(false);
          });
        },
        // Refused (no tap yet on iOS, low power mode); the next tap retries.
        () => { pending = false; },
      );
    };
    request();
    document.addEventListener('visibilitychange', request);
    // Both, since WebKit counts different events as a tap across versions.
    window.addEventListener('pointerup', request);
    window.addEventListener('click', request);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', request);
      window.removeEventListener('pointerup', request);
      window.removeEventListener('click', request);
      lock?.release();
      setHeld(false);
    };
  }, [on]);
  return held;
}
