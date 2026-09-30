// Turns successive live snapshots of the matches into the score moments the
// boards animate: a hole won, a nine decided, the cup lead changing, and the
// Derby being clinched.
import {
  TEAMS, cupStanding, holeOutcome, matchStates, segments,
  type HoleOutcome, type MatchScoring, type TeamId,
} from './scoring';

export interface EventMatch extends MatchScoring {
  id: string;
  slot: number;
  session: string;
  nine?: 'front' | 'back';
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
