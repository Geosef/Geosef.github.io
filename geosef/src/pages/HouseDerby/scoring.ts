// Match-play scoring for the House Derby. Pure functions over match data so the
// board, marshal view and tests all agree on one set of rules.
//
// Every match is 9 holes and worth 1 point. Stroke holes are set per match by
// the committee (no handicap math here): a hole listed twice gives two strokes.

export type TeamId = 'og' | 'south';
export const TEAMS: TeamId[] = ['og', 'south'];
export const HOLES_PER_MATCH = 9;
export const TOTAL_POINTS = 36;
/** Defending team keeps the cup on a tie, so it only needs half the points. */
export const DEFENDING_TEAM: TeamId = 'og';

export type HoleOutcome = TeamId | 'halved';

export interface HoleEntry {
  og?: number | null;
  south?: number | null;
  /** Beats the gross scores: pickups, conceded holes, marshal corrections. */
  override?: HoleOutcome | null;
}

export interface MatchScoring {
  /** Hole (1-9) the group tees off on; play wraps from 9 back to 1. */
  startHole?: number;
  strokes: Record<TeamId, number[]>;
  holes: Record<string, HoleEntry | undefined>;
  /** The team that conceded the whole match. */
  concededBy?: TeamId | null;
}

const other = (t: TeamId): TeamId => (t === 'og' ? 'south' : 'og');

export function strokesOn(match: MatchScoring, team: TeamId, hole: number): number {
  return match.strokes[team].filter(h => h === hole).length;
}

/** Winner of a single hole, or null if it isn't fully entered yet. */
export function holeOutcome(match: MatchScoring, hole: number): HoleOutcome | null {
  const entry = match.holes[hole];
  if (!entry) return null;
  if (entry.override) return entry.override;
  if (entry.og == null || entry.south == null) return null;
  const og = entry.og - strokesOn(match, 'og', hole);
  const south = entry.south - strokesOn(match, 'south', hole);
  if (og === south) return 'halved';
  return og < south ? 'og' : 'south';
}

/** Hole numbers in the order this group plays them. */
export function playOrder(startHole = 1): number[] {
  return Array.from({ length: HOLES_PER_MATCH }, (_, i) => ((startHole - 1 + i) % HOLES_PER_MATCH) + 1);
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

export function matchState(match: MatchScoring): MatchState {
  let og = 0;
  let south = 0;
  let thru = 0;
  let closedAt: number | null = null;
  const afterClose: number[] = [];

  for (const hole of playOrder(match.startHole)) {
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
    if (Math.abs(og - south) > HOLES_PER_MATCH - thru) closedAt = thru;
  }

  const diff = og - south;
  const up = Math.abs(diff);
  const leader: TeamId | null = diff > 0 ? 'og' : diff < 0 ? 'south' : null;
  const remaining = HOLES_PER_MATCH - thru;
  const concededBy = match.concededBy ?? null;

  if (concededBy) {
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

  if (closedAt !== null || remaining === 0) {
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
  for (const m of matches) {
    const s = matchState(m);
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
