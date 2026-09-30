import { describe, expect, it } from 'vitest';
import { momentum, momentumStats } from './momentum';
import type { HoleOutcome } from './scoring';

const sessions = [{ id: 'fri', order: 1 }, { id: 'sat', order: 2 }];
const WIN = (t: 'og' | 'south'): HoleOutcome[] => [t, t, t, t, t];
const match = (id: string, session: string, results: HoleOutcome[], updatedAt?: number) => ({
  id, session, slot: Number(id.slice(-1)), updatedAt,
  strokes: { og: [], south: [] },
  holes: Object.fromEntries(results.map((r, i) => [i + 1, { result: r }])),
});

describe('momentum', () => {
  it('is empty with no decided points (e.g. after --reset-scores)', () => {
    expect(momentum(sessions, [match('f1', 'fri', []), match('f2', 'fri', ['og'])])).toEqual([]);
  });

  it('runs the margin in the order points landed', () => {
    const steps = momentum(sessions, [
      match('f1', 'fri', WIN('og'), 30),
      match('f2', 'fri', WIN('south'), 10),
      match('f3', 'fri', WIN('south'), 20),
    ]);
    expect(steps.map(s => s.matchId)).toEqual(['f2', 'f3', 'f1']);
    expect(steps.map(s => s.margin)).toEqual([-1, -2, -1]);
  });

  it('keeps stages in order even if an earlier stage was scored later (a correction)', () => {
    const steps = momentum(sessions, [match('s1', 'sat', WIN('og'), 10), match('f1', 'fri', WIN('south'), 99)]);
    expect(steps.map(s => s.matchId)).toEqual(['f1', 's1']);
  });

  it('counts a halved nine as half each', () => {
    const halved: HoleOutcome[] = Array(9).fill('halved');
    expect(momentum(sessions, [match('f1', 'fri', halved)])[0]).toMatchObject({ margin: 0, points: { og: 0.5, south: 0.5 }, winner: null });
  });

  it('breaks ties (bulk-written data) by slot', () => {
    const steps = momentum(sessions, [match('f2', 'fri', WIN('og'), 5), match('f1', 'fri', WIN('south'), 5)]);
    expect(steps.map(s => s.matchId)).toEqual(['f1', 'f2']);
  });
});

describe('momentumStats', () => {
  it('counts lead changes (not returns to level) and biggest leads', () => {
    const steps = [1, 2, 1, 0, -1, 0, 1].map(margin => ({ margin }) as Parameters<typeof momentumStats>[0][number]);
    expect(momentumStats(steps)).toEqual({ changes: 2, biggest: { og: 2, south: 1 } });
  });
});
