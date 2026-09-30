import { useCallback, useEffect, useRef, useState } from 'react';
import { diffEvents, type EventMatch, type ScoreEvent } from './scoreEvents';
import type { HoleOutcome, TeamId } from './scoring';

export type Banner = Extract<ScoreEvent, { kind: 'point' | 'lead' }> & { key: number };
export type Celebration = Extract<ScoreEvent, { kind: 'clinch' }> & { key: number };

const FLASH_MS = 1400;
/** How long each banner holds; the lead takeover is the bigger moment, so longer. */
export const BANNER_MS: Record<Banner['kind'], number> = { point: 3400, lead: 4400 };
export const CELEBRATE_MS = 9000;

/**
 * Watches live match data and exposes the moments to animate. The first
 * snapshot is the baseline, so opening a board never replays history.
 */
export function useScoreMoments(matches: EventMatch[] | null) {
  const prev = useRef<EventMatch[] | null>(null);
  const seq = useRef(0);
  const [flashes, setFlashes] = useState<Record<string, { result: HoleOutcome; key: number }>>({});
  const [queue, setQueue] = useState<Banner[]>([]);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  /** Bumps per team when they win a point, to replay the horseshoe swing. */
  const [pulse, setPulse] = useState<Record<TeamId, number>>({ og: 0, south: 0 });
  const [leadGlow, setLeadGlow] = useState<{ team: TeamId | null; key: number } | null>(null);

  /** Animates events: live diffs, or a replayed moment. */
  const play = useCallback((events: ScoreEvent[]) => {
    for (const e of events) {
      const key = ++seq.current;
      if (e.kind === 'hole') {
        setFlashes(f => ({ ...f, [e.matchId]: { result: e.result, key } }));
        setTimeout(() => setFlashes(f => {
          if (f[e.matchId]?.key !== key) return f;
          const { [e.matchId]: _, ...rest } = f;
          return rest;
        }), FLASH_MS);
      } else if (e.kind === 'point' || e.kind === 'lead') {
        setQueue(q => [...q, { ...e, key }]);
        if (e.kind === 'point' && e.winner) {
          const team = e.winner;
          setPulse(p => ({ ...p, [team]: p[team] + 1 }));
        }
      } else {
        setCelebration({ ...e, key });
        setTimeout(() => setCelebration(c => (c?.key === key ? null : c)), CELEBRATE_MS);
      }
    }
  }, []);

  useEffect(() => {
    if (!matches) return;
    const before = prev.current;
    prev.current = matches;
    if (before) play(diffEvents(before, matches));
  }, [matches, play]);

  // Show banners one at a time: the point, then the lead change it caused.
  // The header glow fires with the lead takeover, not ahead of it.
  const banner = queue[0] ?? null;
  useEffect(() => {
    if (!banner) return;
    if (banner.kind === 'lead') setLeadGlow({ team: banner.leader, key: banner.key });
    const t = setTimeout(() => setQueue(q => q.slice(1)), BANNER_MS[banner.kind]);
    return () => clearTimeout(t);
  }, [banner]);

  return { flashes, banner, celebration, pulse, leadGlow, play, dismissCelebration: () => setCelebration(null) };
}

/** Counts from the previous value to the new one in half-point steps. */
export function useCountUp(target: number, stepMs = 180): number {
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (shown === target) return;
    const t = setTimeout(() => setShown(s => (s < target ? Math.min(target, s + 0.5) : Math.max(target, s - 0.5))), stepMs);
    return () => clearTimeout(t);
  }, [shown, target, stepMs]);
  return shown;
}
