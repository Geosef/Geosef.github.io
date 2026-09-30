// What the TV boards show when, driven only by scores (never tee times, since
// rounds run long). Once a stage has its first score the boards hold on the
// live board until every match in it is final, including gaps between nines
// and staggered starts. In dead time (before a stage's first score, after
// its last result) they cycle the board with a recap of the stage just played
// and the pairings coming up. The cycle runs off the wall clock, so every
// screen showing the board changes segment at the same moment.
import { matchStates, type MatchPhase, type MatchScoring } from './scoring';

export type Segment =
  | { kind: 'board' }
  | { kind: 'recap'; session: string }
  | { kind: 'next'; session: string };

export type SegmentKind = Segment['kind'];

/** How long each segment holds, in ms. The board is home, so it holds longest. */
export const DWELL: Record<SegmentKind, number> = { board: 25_000, recap: 12_000, next: 15_000 };

export const BOARD: Segment = { kind: 'board' };

type DirectedMatch = MatchScoring & { session: string };

const phases = (m: MatchScoring): MatchPhase[] => matchStates(m).map(s => s.phase);
const notStarted = (m: MatchScoring) => phases(m).every(p => p === 'not-started');

/** A stage is in play from its first score until every match in it is final. */
function inPlay(matches: DirectedMatch[]): boolean {
  const all = matches.flatMap(phases);
  return all.some(p => p !== 'not-started') && all.some(p => p !== 'final');
}

/**
 * The segments to cycle through right now, board first. `ignorePlay` lists
 * what dead time would show even mid-play (for pinning a segment to preview).
 */
export function playlist(sessions: Array<{ id: string; order: number }>, matches: DirectedMatch[], ignorePlay = false): Segment[] {
  const ordered = [...sessions].sort((a, b) => a.order - b.order);
  const inSession = (id: string) => matches.filter(m => m.session === id);
  if (!ignorePlay && ordered.some(s => inPlay(inSession(s.id)))) return [BOARD];
  // The latest stage with a result, and the first with a match still to tee off.
  const recap = [...ordered].reverse().find(s => inSession(s.id).some(m => phases(m).includes('final')));
  const next = ordered.find(s => inSession(s.id).some(notStarted));
  return [
    BOARD,
    ...(recap ? [{ kind: 'recap', session: recap.id } as const] : []),
    ...(next ? [{ kind: 'next', session: next.id } as const] : []),
  ];
}

/** The segment showing at `now` (ms since epoch), and how long until it changes. */
export function segmentAt(list: Segment[], now: number): { segment: Segment; endsIn: number } {
  const total = list.reduce((t, s) => t + DWELL[s.kind], 0);
  let t = now % total;
  for (const segment of list) {
    const d = DWELL[segment.kind];
    if (t < d) return { segment, endsIn: d - t };
    t -= d;
  }
  return { segment: list[0], endsIn: DWELL[list[0].kind] };
}

/** Stable identity for a segment, to key transitions on. */
export const segmentKey = (s: Segment) => (s.kind === 'board' ? 'board' : `${s.kind}:${s.session}`);

/** Matches from `session` that haven't teed off yet. */
export function toPlay<T extends DirectedMatch>(matches: T[], session: string): T[] {
  return matches.filter(m => m.session === session && notStarted(m));
}

/** Matches from `session` with a result. */
export function decided<T extends DirectedMatch>(matches: T[], session: string): T[] {
  return matches.filter(m => m.session === session && phases(m).every(p => p === 'final'));
}
