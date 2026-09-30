// Turns successive live snapshots of the matches into the score moments the
// boards animate: a hole won, a nine decided, the cup lead changing, and the
// Derby being clinched.
import {
  TEAMS, cupStanding, holeOutcome, matchPoints, matchStates, segments,
  type HoleOutcome, type MatchScoring, type TeamId,
} from './scoring';

export interface EventMatch extends MatchScoring {
  id: string;
  slot: number;
  session: string;
  nine?: 'front' | 'back';
  /** When a score was last entered (ms). */
  updatedAt?: number;
}

export type ScoreEvent =
  | { kind: 'hole'; matchId: string; result: HoleOutcome }
  | {
      kind: 'point'; matchId: string; slot: number; session: string;
      /** Which nine, for indoor matches. */
      nine: 'front' | 'back' | null;
      winner: TeamId | null; label: string;
    }
  | { kind: 'lead'; leader: TeamId | null }
  | { kind: 'clinch'; team: TeamId };

/**
 * More matches than this changing in one update means a bulk rewrite (demo
 * state, reset, re-seed), not live play: only a clinch is reported then.
 */
export const BULK_THRESHOLD = 3;

function results(m: MatchScoring): Record<number, HoleOutcome | null> {
  const out: Record<number, HoleOutcome | null> = {};
  for (const h of segments(m).flat()) out[h] = holeOutcome(m, h);
  return out;
}

const leaderOf = (points: Record<TeamId, number>): TeamId | null =>
  points.og === points.south ? null : points.og > points.south ? 'og' : 'south';

export function diffEvents(prev: EventMatch[], next: EventMatch[]): ScoreEvent[] {
  const before = new Map(prev.map(m => [m.id, m]));
  const holeEvents: ScoreEvent[] = [];
  const pointEvents: ScoreEvent[] = [];
  let changed = 0;

  for (const m of next) {
    const old = before.get(m.id);
    if (!old) continue;
    const r0 = results(old);
    const r1 = results(m);
    let touched = old.concededBy !== m.concededBy;
    for (const h of Object.keys(r1).map(Number)) {
      if (r0[h] === r1[h]) continue;
      touched = true;
      const result = r1[h];
      if (result) holeEvents.push({ kind: 'hole', matchId: m.id, result });
    }
    if (touched) changed++;

    const s0 = matchStates(old);
    const s1 = matchStates(m);
    s1.forEach((st, i) => {
      if (st.phase !== 'final' || s0[i]?.phase === 'final') return;
      pointEvents.push({
        kind: 'point', matchId: m.id, slot: m.slot, session: m.session,
        nine: m.nine ?? null, winner: st.winner, label: st.label,
      });
    });
  }

  const c0 = cupStanding(prev);
  const c1 = cupStanding(next);
  const clinch: ScoreEvent[] = c1.clinched && !c0.clinched ? [{ kind: 'clinch', team: c1.clinched }] : [];
  if (changed > BULK_THRESHOLD) return clinch;

  const lead: ScoreEvent[] = [];
  const l0 = leaderOf(c0.points);
  const l1 = leaderOf(c1.points);
  // A lead change is only news once some points are on the board.
  if (l0 !== l1 && TEAMS.some(t => c1.points[t] > 0)) lead.push({ kind: 'lead', leader: l1 });

  return [...holeEvents, ...pointEvents, ...lead, ...clinch];
}

/**
 * The moment to loop for replay clips, rebuilt from the data rather than a
 * live diff: the clinch once the Derby is won, else the most recently scored
 * nine to finish (or `matchId`'s, if it has finished). As live: the closing
 * hole's flash, the point, then the lead change if that point swung the cup
 * (so a stage ending level replays as "All square").
 */
export function latestMoment(matches: EventMatch[], matchId?: string): ScoreEvent[] {
  const { clinched, points: after } = cupStanding(matches);
  if (clinched && !matchId) return [{ kind: 'clinch', team: clinched }];
  const finished = matches
    .filter(m => matchStates(m).some(s => s.phase === 'final'))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const m = matchId ? finished.find(x => x.id === matchId) : finished[0];
  if (!m) return [];
  const states = matchStates(m);
  const i = states.map(s => s.phase).lastIndexOf('final');
  const st = states[i];
  const closing = segments(m)[i].filter(h => !st.afterClose.includes(h) && holeOutcome(m, h)).pop();
  const result = closing ? holeOutcome(m, closing) : null;
  // Did this point swing the cup? Only knowable for the latest finish: an
  // older match's "before" has other results mixed in since.
  const won = matchPoints(st);
  const before = { og: after.og - won.og, south: after.south - won.south };
  const swung = m === finished[0] && leaderOf(before) !== leaderOf(after) && TEAMS.some(t => after[t] > 0);
  return [
    ...(result ? [{ kind: 'hole', matchId: m.id, result } as const] : []),
    { kind: 'point', matchId: m.id, slot: m.slot, session: m.session, nine: m.nine ?? null, winner: st.winner, label: st.label },
    ...(swung ? [{ kind: 'lead', leader: leaderOf(after) } as const] : []),
  ];
}
