import { describe, expect, it } from 'vitest';
import {
  cupStanding, holeOutcome, matchPoints, matchStates, playOrder, segments, strokesOn,
  type HoleOutcome, type MatchScoring,
} from './scoring';

/** State of a 9-hole match (its only point). */
const matchState = (m: MatchScoring) => matchStates(m)[0];

const noStrokes = { og: [], south: [] };

/** Build a match from hole outcomes in play order. */
function fromOutcomes(outcomes: HoleOutcome[], extra: Partial<MatchScoring> = {}): MatchScoring {
  const start = extra.startHole ?? 1;
  const holes: MatchScoring['holes'] = {};
  playOrder(start).slice(0, outcomes.length).forEach((h, i) => {
    holes[h] = { result: outcomes[i] };
  });
  return { strokes: noStrokes, holes, ...extra };
}

describe('holeOutcome', () => {
  it('is null until a result is recorded', () => {
    const m: MatchScoring = { strokes: noStrokes, holes: { 1: {}, 2: { result: null } } };
    expect(holeOutcome(m, 1)).toBeNull();
    expect(holeOutcome(m, 2)).toBeNull();
    expect(holeOutcome(m, 3)).toBeNull();
  });

  it('returns the recorded result', () => {
    const m: MatchScoring = { strokes: noStrokes, holes: { 1: { result: 'south' }, 2: { result: 'halved' } } };
    expect(holeOutcome(m, 1)).toBe('south');
    expect(holeOutcome(m, 2)).toBe('halved');
  });
});

describe('strokesOn', () => {
  it('counts a hole listed twice as two strokes', () => {
    const m: MatchScoring = { strokes: { og: [], south: [3, 5, 5] }, holes: {} };
    expect(strokesOn(m, 'south', 3)).toBe(1);
    expect(strokesOn(m, 'south', 5)).toBe(2);
    expect(strokesOn(m, 'og', 5)).toBe(0);
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
    const s = matchState({ strokes: noStrokes, holes: { 1: {} } });
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
    const m: MatchScoring = { strokes: noStrokes, holes: { 1: { result: 'og' }, 3: { result: 'og' } } };
    expect(matchState(m)).toMatchObject({ thru: 2, up: 2, label: '2 UP thru 2' });
  });
});

describe('back nine (indoor holes 10-18)', () => {
  const back = (results: Record<number, HoleOutcome>, extra: Partial<MatchScoring> = {}): MatchScoring => ({
    firstHole: 10,
    strokes: noStrokes,
    holes: Object.fromEntries(Object.entries(results).map(([h, r]) => [h, { result: r }])),
    ...extra,
  });

  it('plays holes 10-18', () => {
    expect(segments(back({}))).toEqual([[10, 11, 12, 13, 14, 15, 16, 17, 18]]);
  });

  it('scores results on holes 10-18', () => {
    expect(matchState(back({ 10: 'og', 11: 'og', 12: 'south' }))).toMatchObject({ phase: 'live', label: '1 UP thru 3' });
  });

  it('closes out using play order within the nine', () => {
    expect(matchState(back({ 10: 'south', 11: 'south', 12: 'south', 13: 'south', 14: 'south' }))).toMatchObject({ label: '5&4' });
  });

  it('ignores stray front-nine holes', () => {
    expect(matchState(back({ 1: 'og', 2: 'og' })).phase).toBe('not-started');
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

  it('gives OG the win at 18-18', () => {
    const s = cupStanding([...Array(18).fill(0).map(() => won('og')), ...Array(18).fill(0).map(() => won('south'))]);
    expect(s.points).toEqual({ og: 18, south: 18 });
    expect(s.clinched).toBe('og');
  });

  it('requires South to reach 18.5', () => {
    const at18 = cupStanding(Array(18).fill(0).map(() => won('south')));
    expect(at18.clinched).toBeNull();
    const at185 = cupStanding([...Array(18).fill(0).map(() => won('south')), halved()]);
    expect(at185.clinched).toBe('south');
  });

  it('has OG winning past 18 too', () => {
    const s = cupStanding([...Array(18).fill(0).map(() => won('og')), halved()]);
    expect(s.clinched).toBe('og');
  });
});
