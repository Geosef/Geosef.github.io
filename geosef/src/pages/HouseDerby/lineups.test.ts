import { describe, expect, it } from 'vitest';
import { announcement, groupIds, groupSlots, isAnnounced, lineupProblems } from './lineups';
import type { Match, Session } from './data';

const session = (id: string, order: number, group: string, format: string, pairings: number): Session =>
  ({ id, order, group, format, pairings, day: 'fri', name: id, venue: '', holes: 9 });

const SESSIONS = [
  session('sat-pm', 5, 'sat-pm', 'singles', 2),
  session('fri-w1', 1, 'fri', 'alt-shot', 2),
  session('fri-w2', 2, 'fri', 'alt-shot', 1),
];

const match = (id: string, sessionId: string, slot: number, nine?: 'front' | 'back'): Match =>
  ({ id, session: sessionId, slot, nine, players: { og: [], south: [] }, strokes: { og: [], south: [] }, holes: {}, pending: false });

describe('groupSlots', () => {
  it('numbers slots across a group’s stages in play order', () => {
    expect(groupIds(SESSIONS)).toEqual(['fri', 'sat-pm']);
    expect(groupSlots(SESSIONS, 'fri').map(s => [s.n, s.session.id, s.slot])).toEqual([
      [1, 'fri-w1', 1], [2, 'fri-w1', 2], [3, 'fri-w2', 1],
    ]);
  });
});

describe('lineupProblems', () => {
  const layout = groupSlots(SESSIONS, 'fri');

  it('passes a full lineup with no repeats', () => {
    expect(lineupProblems({ 1: ['a', 'b'], 2: ['c', 'd'], 3: ['e', 'f'] }, layout)).toEqual([]);
  });

  it('flags empty seats and players used twice', () => {
    expect(lineupProblems({ 1: ['a', ''], 2: ['c', 'a'] }, layout)).toEqual([
      'Slot 1 needs 1 more',
      'Slot 2 repeats a player from slot 1',
      'Slot 3 needs 2 more',
    ]);
  });

  it('wants one player a side in singles', () => {
    expect(lineupProblems({ 1: ['a'], 2: ['b'] }, groupSlots(SESSIONS, 'sat-pm'))).toEqual([]);
  });
});

describe('announcement', () => {
  it('puts slot N against slot N on every nine of the match', () => {
    const matches = [
      match('fri-w1-1-front', 'fri-w1', 1, 'front'), match('fri-w1-1-back', 'fri-w1', 1, 'back'),
      match('fri-w1-2-front', 'fri-w1', 2, 'front'), match('fri-w1-2-back', 'fri-w1', 2, 'back'),
      match('fri-w2-1-front', 'fri-w2', 1, 'front'), match('fri-w2-1-back', 'fri-w2', 1, 'back'),
      match('sat-pm-1', 'sat-pm', 1),
    ];
    const writes = announcement(groupSlots(SESSIONS, 'fri'), matches, {
      og: { 1: ['a', 'b'], 2: ['c', 'd'], 3: ['e', 'f'] },
      south: { 1: ['u', 'v'], 2: ['w', 'x'], 3: ['y', 'z'] },
    });
    expect(writes).toHaveLength(6);
    expect(writes.find(w => w.matchId === 'fri-w2-1-back')?.players).toEqual({ og: ['e', 'f'], south: ['y', 'z'] });
  });
});

describe('isAnnounced', () => {
  it('needs both sides on every match', () => {
    const m = match('sat-pm-1', 'sat-pm', 1);
    expect(isAnnounced([m])).toBe(false);
    expect(isAnnounced([{ ...m, players: { og: ['a'], south: ['b'] } }])).toBe(true);
    expect(isAnnounced([])).toBe(false);
  });
});
