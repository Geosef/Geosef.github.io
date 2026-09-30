// Match-play scoring for the House Derby. Pure functions over match data so the
// board, marshal view and tests all agree on one set of rules.
//
// Every point is a 9-hole match. Indoor pairings play 18 holes as two separate
// matches: a front nine (holes 1-9) and a back nine (holes 10-18).
//
// Marshals record only who won each hole. Stroke holes are set per match by
// the committee and shown so the group can call net results; a hole listed
// twice gives two strokes.

export type TeamId = 'og' | 'south';
export const TEAMS: TeamId[] = ['og', 'south'];
export const TOTAL_POINTS = 36;
/** An 18-18 tie goes to this team, so it wins at half the points. */
export const TIE_WINNER: TeamId = 'og';

export type HoleOutcome = TeamId | 'halved';

export interface HoleEntry {
  result?: HoleOutcome | null;
}

export interface MatchScoring {
  /** First hole of this nine: 1, or 10 for an indoor back nine. */
  firstHole?: number;
  /** Position (1-9) within the nine a group tees off on; play wraps around. */
  startHole?: number;
  strokes: Record<TeamId, number[]>;
  holes: Record<string, HoleEntry | undefined>;
  /** The team that conceded the match (only counts if not already decided). */
  concededBy?: TeamId | null;
}

const other = (t: TeamId): TeamId => (t === 'og' ? 'south' : 'og');

export function strokesOn(match: MatchScoring, team: TeamId, hole: number): number {
  return match.strokes[team].filter(h => h === hole).length;
}

/** Recorded result of a hole, or null if not entered yet. */
export function holeOutcome(match: MatchScoring, hole: number): HoleOutcome | null {
  return match.holes[hole]?.result ?? null;
}

/** Hole numbers in the order a 9-hole group plays them. */
export function playOrder(startHole = 1): number[] {
  return Array.from({ length: 9 }, (_, i) => ((startHole - 1 + i) % 9) + 1);
}

/**
 * The match's holes in play order, as a list of nines. Every match is a single
 * nine today; the list shape lets callers stay agnostic.
 */
export function segments(match: MatchScoring): number[][] {
  const offset = (match.firstHole ?? 1) - 1;
  return [playOrder(match.startHole).map(h => h + offset)];
}

export type MatchPhase = 'not-started' | 'live' | 'final';

export interface MatchState {
  phase: MatchPhase;
  /** Holes up for the leader (0 when all square). */
  up: number;
  leader: TeamId | null;
  /** Holes with a decided outcome counted toward the match. */
  thru: number;
  remaining: number;
  dormie: boolean;
  /** Final winner; null while live or if halved. */
  winner: TeamId | null;
  /** Holes entered after the match was already decided (display only). */
  afterClose: number[];
  /** Short status, e.g. "2 UP thru 6", "DORMIE", "3&2", "A/S", "1 UP". */
  label: string;
  concededBy: TeamId | null;
}

/** Status of every point in a match: one entry per nine. */
export function matchStates(match: MatchScoring): MatchState[] {
  return segments(match).map(order => segmentState(match, order));
}

/** Status of one 9-hole point, given its holes in play order. */
export function segmentState(match: MatchScoring, order: number[]): MatchState {
  let og = 0;
  let south = 0;
  let thru = 0;
  let closedAt: number | null = null;
  const afterClose: number[] = [];

  for (const hole of order) {
    const outcome = holeOutcome(match, hole);
    if (!outcome) continue;
    // Holes past a clinched result don't change it, but we flag them so the
    // marshal view can show they were ignored instead of silently dropping them.
    if (closedAt !== null) {
      afterClose.push(hole);
      continue;
    }
    thru++;
    if (outcome === 'og') og++;
    else if (outcome === 'south') south++;
    if (Math.abs(og - south) > order.length - thru) closedAt = thru;
  }

  const diff = og - south;
  const up = Math.abs(diff);
  const leader: TeamId | null = diff > 0 ? 'og' : diff < 0 ? 'south' : null;
  const remaining = order.length - thru;
  const concededBy = match.concededBy ?? null;
  const decidedByPlay = closedAt !== null || remaining === 0;

  // A concession only takes the nines still in play; a finished front nine
  // keeps its result when the back is conceded.
  if (concededBy && !decidedByPlay) {
    return {
      phase: 'final', up, leader, thru, remaining, dormie: false,
      winner: other(concededBy), afterClose, label: 'Conceded', concededBy,
    };
  }

  if (thru === 0) {
    return {
      phase: 'not-started', up: 0, leader: null, thru, remaining, dormie: false,
      winner: null, afterClose, label: 'Not started', concededBy,
    };
  }

  if (decidedByPlay) {
    // "3&2" when won early, "1 UP"/"2 UP" when it went the distance.
    const label = leader === null ? 'A/S' : remaining > 0 ? `${up}&${remaining}` : `${up} UP`;
    return {
      phase: 'final', up, leader, thru, remaining, dormie: false,
      winner: leader, afterClose, label, concededBy,
    };
  }

  const dormie = leader !== null && up === remaining;
  const label = leader === null
    ? `A/S thru ${thru}`
    : dormie ? `DORMIE` : `${up} UP thru ${thru}`;
  return { phase: 'live', up, leader, thru, remaining, dormie, winner: null, afterClose, label, concededBy };
}

/** Points a finished match awards each team. */
export function matchPoints(state: MatchState): Record<TeamId, number> {
  if (state.phase !== 'final') return { og: 0, south: 0 };
  if (!state.winner) return { og: 0.5, south: 0.5 };
  return state.winner === 'og' ? { og: 1, south: 0 } : { og: 0, south: 1 };
}

/** Points if every live match ended as it stands now (all square = half each). */
function projectedPoints(state: MatchState): Record<TeamId, number> {
  if (state.phase === 'final') return matchPoints(state);
  if (state.phase === 'not-started') return { og: 0, south: 0 };
  if (!state.leader) return { og: 0.5, south: 0.5 };
  return state.leader === 'og' ? { og: 1, south: 0 } : { og: 0, south: 1 };
}

export interface CupStanding {
  points: Record<TeamId, number>;
  projected: Record<TeamId, number>;
  /** Points each team still needs to win (the tie winner needs half). */
  needed: Record<TeamId, number>;
  /** The winning team, once the result can no longer change. */
  clinched: TeamId | null;
}

export function cupStanding(matches: MatchScoring[]): CupStanding {
  const points = { og: 0, south: 0 };
  const projected = { og: 0, south: 0 };
  for (const s of matches.flatMap(matchStates)) {
    const p = matchPoints(s);
    const pr = projectedPoints(s);
    for (const t of TEAMS) {
      points[t] += p[t];
      projected[t] += pr[t];
    }
  }

  const half = TOTAL_POINTS / 2;
  const target = (t: TeamId) => (t === TIE_WINNER ? half : half + 0.5);
  const needed = {
    og: Math.max(0, target('og') - points.og),
    south: Math.max(0, target('south') - points.south),
  };

  const clinched = TEAMS.find(t => points[t] >= target(t)) ?? null;

  return { points, projected, needed, clinched };
}
