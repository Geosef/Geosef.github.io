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

const PORTRAIT = '(orientation: portrait)';

/** Whether the viewport is taller than it is wide; updates on rotate/resize. */
export function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(() => window.matchMedia(PORTRAIT).matches);
  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT);
    const onChange = () => setPortrait(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return portrait;
}

/**
 * Keeps the screen awake while `on`, for boards left running on a phone or
 * TV. The browser drops the lock whenever the page is hidden, so it's
 * re-requested when the page comes back. No-op where unsupported.
 */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const request = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen').then(
        l => { if (done) l.release(); else lock = l; },
        // Denied (e.g. low battery mode); the board still works, it just may sleep.
        () => {},
      );
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', request);
      lock?.release();
    };
  }, [on]);
}
