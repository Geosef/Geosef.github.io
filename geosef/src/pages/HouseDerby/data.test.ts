import { describe, expect, it } from 'vitest';
import { activeSessionId, thruLabel } from './data';
import type { HoleOutcome, MatchScoring } from './scoring';

const m = (results: HoleOutcome[], extra: Partial<MatchScoring> = {}): MatchScoring => ({
  strokes: { og: [], south: [] },
  holes: Object.fromEntries(results.map((r, i) => [i + 1, { result: r }])),
  ...extra,
});

describe('thruLabel', () => {
  it('shows a dash before the first hole', () => expect(thruLabel(m([]))).toBe('–'));
  it('shows the last hole played', () => expect(thruLabel(m(['og', 'halved', 'south']))).toBe('3'));
  it('shows F once decided, including early close-outs', () => {
    expect(thruLabel(m(['og', 'og', 'og', 'og', 'og']))).toBe('F');
  });
  it('counts through 18 for indoor matches', () => {
    const front = Array<HoleOutcome>(9).fill('halved');
    expect(thruLabel(m([...front, 'og', 'og'], { holeCount: 18 }))).toBe('11');
  });
  it('follows play order on a shotgun start', () => {
    expect(thruLabel({ strokes: { og: [], south: [] }, startHole: 8, holes: { 8: { result: 'og' }, 9: { result: 'og' }, 1: { result: 'og' } } })).toBe('1');
  });
});

describe('activeSessionId', () => {
  const sessions = ['fri', 'sat-am', 'sat-pm'].map((id, order) => ({
    id, order, day: 'sat' as const, name: id, venue: '', format: 'singles', holes: 9 as const,
  }));
  const match = (session: string, results: HoleOutcome[]) => ({
    ...m(results), id: `${session}-1`, session, slot: 1, players: { og: [], south: [] }, pending: false,
  });
  const done = Array<HoleOutcome>(5).fill('og');

  it('is the first stage before anything is played', () => {
    expect(activeSessionId(sessions, sessions.map(s => match(s.id, [])))).toBe('fri');
  });
  it('moves on once a stage is complete, even before the next starts', () => {
    expect(activeSessionId(sessions, [match('fri', done), match('sat-am', []), match('sat-pm', [])])).toBe('sat-am');
  });
  it('stays on the last stage once everything is final', () => {
    expect(activeSessionId(sessions, sessions.map(s => match(s.id, done)))).toBe('sat-pm');
  });
});
