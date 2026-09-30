// The cup's running margin, point by point, for the TV's momentum chart.
// Built only from the match docs' current scores (no edit history), so
// clearing scores clears the chart and demo data drives it like real play.
import { matchPoints, matchStates, type MatchScoring, type TeamId } from './scoring';

export interface MomentumStep {
  /** OG minus South after this point. */
  margin: number;
  points: Record<TeamId, number>;
  winner: TeamId | null;
  session: string;
  matchId: string;
}

type MomentumMatch = MatchScoring & { id: string; session: string; slot: number; nine?: 'front' | 'back'; updatedAt?: number };

/**
 * Every decided point in the order it landed. Stages are played one at a
 * time, so stage order comes first; within a stage, when the match was last
 * scored (a late correction can only reshuffle within its own stage), then
 * slot and nine for ties such as bulk-written demo data.
 */
export function momentum(sessions: Array<{ id: string; order: number }>, matches: MomentumMatch[]): MomentumStep[] {
  const order = new Map(sessions.map(s => [s.id, s.order]));
  const decided = matches
    .flatMap(m => matchStates(m).filter(s => s.phase === 'final').map(state => ({ m, state })))
    .sort((a, b) =>
      (order.get(a.m.session) ?? 0) - (order.get(b.m.session) ?? 0)
      || (a.m.updatedAt ?? 0) - (b.m.updatedAt ?? 0)
      || a.m.slot - b.m.slot
      || (a.m.nine === 'back' ? 1 : 0) - (b.m.nine === 'back' ? 1 : 0));
  const points = { og: 0, south: 0 };
  return decided.map(({ m, state }) => {
    const p = matchPoints(state);
    points.og += p.og;
    points.south += p.south;
    return { margin: points.og - points.south, points: { ...points }, winner: state.winner, session: m.session, matchId: m.id };
  });
}

const leader = (margin: number): TeamId | null => (margin > 0 ? 'og' : margin < 0 ? 'south' : null);

/** Headline numbers: how often the lead changed hands, and each side's biggest lead. */
export function momentumStats(steps: MomentumStep[]) {
  let changes = 0;
  let prev: TeamId | null = null;
  const biggest: Record<TeamId, number> = { og: 0, south: 0 };
  for (const s of steps) {
    const l = leader(s.margin);
    // A change is a new side in front, not a return to level.
    if (l && prev && l !== prev) changes++;
    if (l) prev = l;
    if (s.margin > biggest.og) biggest.og = s.margin;
    if (-s.margin > biggest.south) biggest.south = -s.margin;
  }
  return { changes, biggest };
}
