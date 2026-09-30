// Match-play scoring for the House Derby. Pure functions over match data so the
// board, marshal view and tests all agree on one set of rules.
//
// Every point is a 9-hole match. Most matches are 9 holes; the indoor matches
// are 18 holes scored as two separate points (front and back nine).
//
// Marshals record only who won each hole. Stroke holes are set per match by
// the committee and shown so the group can call net results; a hole listed
// twice gives two strokes.

export type TeamId = 'og' | 'south';
export const TEAMS: TeamId[] = ['og', 'south'];
export const TOTAL_POINTS = 36;
/** Defending team keeps the cup on a tie, so it only needs half the points. */
export const DEFENDING_TEAM: TeamId = 'og';

export type HoleOutcome = TeamId | 'halved';

export interface HoleEntry {
  result?: HoleOutcome | null;
}

export interface MatchScoring {
  /** 18-hole matches are worth two points: front and back nine. Default 9. */
  holeCount?: 9 | 18;
  /** Hole (1-9) a 9-hole group tees off on; play wraps from 9 back to 1. */
  startHole?: number;
  strokes: Record<TeamId, number[]>;
  holes: Record<string, HoleEntry | undefined>;
  /** The team that conceded the match (any nine not already decided). */
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

/** Each point-bearing nine of a match, as holes in play order. */
export function segments(match: MatchScoring): number[][] {
  if (match.holeCount === 18) {
    return [[1, 2, 3, 4, 5, 6, 7, 8, 9], [10, 11, 12, 13, 14, 15, 16, 17, 18]];
  }
  return [playOrder(match.startHole)];
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
  /** Points each team still needs to win (challenger) or retain (defender). */
  needed: Record<TeamId, number>;
  /** Set once the result can no longer change. */
  clinched: { team: TeamId; how: 'wins' | 'retains' } | null;
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
  const target = (t: TeamId) => (t === DEFENDING_TEAM ? half : half + 0.5);
  const needed = {
    og: Math.max(0, target('og') - points.og),
    south: Math.max(0, target('south') - points.south),
  };

  let clinched: CupStanding['clinched'] = null;
  for (const t of TEAMS) {
    if (points[t] >= half + 0.5) clinched = { team: t, how: 'wins' };
  }
  if (!clinched && points[DEFENDING_TEAM] >= half) {
    clinched = { team: DEFENDING_TEAM, how: 'retains' };
  }

  return { points, projected, needed, clinched };
}
