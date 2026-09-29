import { describe, expect, it } from 'vitest';
import {
  cupStanding, holeOutcome, matchPoints, matchState, playOrder,
  type HoleOutcome, type MatchScoring,
} from './scoring';

const noStrokes = { og: [], south: [] };

/** Build a match from hole outcomes in play order via overrides. */
function fromOutcomes(outcomes: HoleOutcome[], extra: Partial<MatchScoring> = {}): MatchScoring {
  const start = extra.startHole ?? 1;
  const holes: MatchScoring['holes'] = {};
  playOrder(start).slice(0, outcomes.length).forEach((h, i) => {
    holes[h] = { override: outcomes[i] };
  });
  return { strokes: noStrokes, holes, ...extra };
}

describe('holeOutcome', () => {
  it('is null until both sides have a gross score', () => {
    const m: MatchScoring = { strokes: noStrokes, holes: { 1: { og: 4 } } };
    expect(holeOutcome(m, 1)).toBeNull();
    expect(holeOutcome(m, 2)).toBeNull();
  });

  it('compares gross when nobody gets a stroke', () => {
    const m: MatchScoring = { strokes: noStrokes, holes: { 1: { og: 4, south: 5 }, 2: { og: 5, south: 5 } } };
    expect(holeOutcome(m, 1)).toBe('og');
    expect(holeOutcome(m, 2)).toBe('halved');
  });

  it('applies stroke holes, including two strokes on one hole', () => {
    const m: MatchScoring = {
      strokes: { og: [], south: [3, 5, 5] },
      holes: { 3: { og: 4, south: 5 }, 5: { og: 4, south: 5 }, 6: { og: 4, south: 5 } },
    };
    expect(holeOutcome(m, 3)).toBe('halved'); // 5 - 1 = 4
    expect(holeOutcome(m, 5)).toBe('south');  // 5 - 2 = 3
    expect(holeOutcome(m, 6)).toBe('og');     // no stroke
  });

  it('lets an override beat the gross scores (pickups, concessions)', () => {
    const m: MatchScoring = { strokes: noStrokes, holes: { 1: { og: 3, south: 7, override: 'south' }, 2: { override: 'halved' } } };
    expect(holeOutcome(m, 1)).toBe('south');
    expect(holeOutcome(m, 2)).toBe('halved');
  });
});

describe('playOrder', () => {
  it('wraps a shotgun start from 9 back to 1', () => {
    expect(playOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(playOrder(4)).toEqual([4, 5, 6, 7, 8, 9, 1, 2, 3]);
  });
});

describe('matchState', () => {
  it('is not started with no decided holes', () => {
    const s = matchState({ strokes: noStrokes, holes: { 1: { og: 4 } } });
    expect(s.phase).toBe('not-started');
    expect(s.label).toBe('Not started');
  });

  it('reports live status', () => {
    const s = matchState(fromOutcomes(['og', 'halved', 'og', 'south', 'og', 'halved']));
    expect(s).toMatchObject({ phase: 'live', leader: 'og', up: 2, thru: 6, label: '2 UP thru 6' });
  });

  it('reports all square while live', () => {
    expect(matchState(fromOutcomes(['og', 'south'])).label).toBe('A/S thru 2');
  });

  it('flags dormie', () => {
    const s = matchState(fromOutcomes(['south', 'south', 'halved', 'halved', 'halved', 'halved', 'halved']));
    expect(s).toMatchObject({ phase: 'live', dormie: true, label: 'DORMIE', leader: 'south' });
  });

  it('closes out early and labels it 3&2', () => {
    const s = matchState(fromOutcomes(['og', 'og', 'og', 'halved', 'halved', 'halved', 'halved']));
    expect(s).toMatchObject({ phase: 'final', winner: 'og', label: '3&2', remaining: 2 });
  });

  it('ignores holes entered after the close but reports them', () => {
    const s = matchState(fromOutcomes(['og', 'og', 'og', 'halved', 'halved', 'halved', 'halved', 'south', 'south']));
    expect(s).toMatchObject({ winner: 'og', label: '3&2', afterClose: [8, 9] });
  });

  it('uses play order, not hole number, to decide the close on a shotgun start', () => {
    // Starts on 4: holes 4-9 then 1. OG wins 4,5,6,7,8; that's 5 up with 4 left after 5 holes.
    const m = fromOutcomes(['og', 'og', 'og', 'og', 'og', 'south'], { startHole: 4 });
    const s = matchState(m);
    expect(s).toMatchObject({ label: '5&4', afterClose: [9] });
  });

  it('labels a match that went the distance', () => {
    const s = matchState(fromOutcomes(['og', 'south', 'og', 'halved', 'halved', 'halved', 'halved', 'halved', 'halved']));
    expect(s).toMatchObject({ phase: 'final', winner: 'og', label: '1 UP' });
  });

  it('halves a match all square after 9', () => {
    const s = matchState(fromOutcomes(Array(9).fill('halved')));
    expect(s).toMatchObject({ phase: 'final', winner: null, label: 'A/S' });
    expect(matchPoints(s)).toEqual({ og: 0.5, south: 0.5 });
  });

  it('awards a conceded match to the other side regardless of score', () => {
    const s = matchState(fromOutcomes(['south', 'south'], { concededBy: 'south' }));
    expect(s).toMatchObject({ phase: 'final', winner: 'og', label: 'Conceded' });
    expect(matchPoints(s)).toEqual({ og: 1, south: 0 });
  });

  it('counts a gap in entry as unplayed', () => {
    const m: MatchScoring = { strokes: noStrokes, holes: { 1: { override: 'og' }, 3: { override: 'og' } } };
    expect(matchState(m)).toMatchObject({ thru: 2, up: 2, label: '2 UP thru 2' });
  });
});

describe('cupStanding', () => {
  const won = (t: 'og' | 'south') => fromOutcomes(Array(5).fill(t)); // 5&4
  const halved = () => fromOutcomes(Array(9).fill('halved'));
  const live = (t: 'og' | 'south') => fromOutcomes([t]);
  const notStarted = (): MatchScoring => ({ strokes: noStrokes, holes: {} });

  it('totals points and projects live leaders', () => {
    const s = cupStanding([won('og'), halved(), live('south'), fromOutcomes(['og', 'south']), notStarted()]);
    expect(s.points).toEqual({ og: 1.5, south: 0.5 });
    expect(s.projected).toEqual({ og: 2, south: 2 });
    expect(s.needed).toEqual({ og: 16.5, south: 18 });
    expect(s.clinched).toBeNull();
  });

  it('lets the defending team retain at 18', () => {
    const s = cupStanding([...Array(18).fill(0).map(() => won('og')), ...Array(18).fill(0).map(() => won('south'))]);
    expect(s.points).toEqual({ og: 18, south: 18 });
    expect(s.clinched).toEqual({ team: 'og', how: 'retains' });
  });

  it('requires the challenger to reach 18.5', () => {
    const at18 = cupStanding(Array(18).fill(0).map(() => won('south')));
    expect(at18.clinched).toBeNull();
    const at185 = cupStanding([...Array(18).fill(0).map(() => won('south')), halved()]);
    expect(at185.clinched).toEqual({ team: 'south', how: 'wins' });
  });

  it('marks the defender as outright winners past 18', () => {
    const s = cupStanding([...Array(18).fill(0).map(() => won('og')), halved()]);
    expect(s.clinched).toEqual({ team: 'og', how: 'wins' });
  });
});
