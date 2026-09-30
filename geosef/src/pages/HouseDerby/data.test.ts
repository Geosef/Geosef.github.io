import { describe, expect, it } from 'vitest';
import { activeSessionId, currentSessionId, thruLabel } from './data';
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
  it('shows course hole numbers on an indoor back nine', () => {
    expect(thruLabel({ firstHole: 10, strokes: { og: [], south: [] }, holes: { 10: { result: 'og' }, 11: { result: 'og' } } })).toBe('11');
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

describe('currentSessionId', () => {
  const sessions = ['fri', 'sat-am', 'sat-pm'].map((id, order) => ({
    id, order, day: 'sat' as const, name: id, venue: '', format: 'singles', holes: 9 as const,
  }));
  const match = (session: string, slot: number, results: HoleOutcome[]) => ({
    ...m(results), id: `${session}-${slot}`, session, slot, players: { og: [], south: [] }, pending: false,
  });
  const done = Array<HoleOutcome>(5).fill('og');

  it('stays on a stage whose played matches are all finished while others wait', () => {
    // Friday done; scramble has three finished and three not started. Nothing is
    // live, but the scramble is still the stage to show, not Friday.
    const ms = [
      match('fri', 1, done),
      ...[1, 2, 3].map(i => match('sat-am', i, done)),
      ...[4, 5, 6].map(i => match('sat-am', i, [])),
      match('sat-pm', 1, []),
    ];
    expect(currentSessionId(sessions, ms)).toBe('sat-am');
  });
  it('prefers the stage with live play', () => {
    expect(currentSessionId(sessions, [match('fri', 1, done), match('sat-am', 1, ['og']), match('sat-pm', 1, [])])).toBe('sat-am');
  });
  it('shows the finished stage between stages', () => {
    expect(currentSessionId(sessions, [match('fri', 1, done), match('sat-am', 1, []), match('sat-pm', 1, [])])).toBe('fri');
  });
});
