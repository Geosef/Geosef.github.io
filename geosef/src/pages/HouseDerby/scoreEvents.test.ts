import { describe, expect, it } from 'vitest';
import { diffEvents, type EventMatch } from './scoreEvents';
import type { HoleOutcome } from './scoring';

function match(id: string, results: HoleOutcome[], extra: Partial<EventMatch> = {}): EventMatch {
  return {
    id, slot: Number(id.split('-').pop()), session: 'sat-pm',
    strokes: { og: [], south: [] },
    holes: Object.fromEntries(results.map((r, i) => [i + 1, { result: r }])),
    ...extra,
  };
}

describe('diffEvents', () => {
  it('reports nothing when nothing changed', () => {
    const ms = [match('m-1', ['og'])];
    expect(diffEvents(ms, ms)).toEqual([]);
  });

  it('reports a newly won hole', () => {
    expect(diffEvents([match('m-1', ['og'])], [match('m-1', ['og', 'south'])]))
      .toContainEqual({ kind: 'hole', matchId: 'm-1', result: 'south' });
  });

  it('reports a corrected hole as a hole event, not a cleared one', () => {
    expect(diffEvents([match('m-1', ['og'])], [match('m-1', [])])).toEqual([]);
    expect(diffEvents([match('m-1', ['og'])], [match('m-1', ['halved'])]))
      .toEqual([{ kind: 'hole', matchId: 'm-1', result: 'halved' }]);
  });

  it('reports a decided nine with its label', () => {
    const events = diffEvents(
      [match('m-4', ['og', 'og', 'og', 'halved', 'halved', 'halved'])],
      [match('m-4', ['og', 'og', 'og', 'halved', 'halved', 'halved', 'halved'])],
    );
    expect(events).toContainEqual({
      kind: 'point', matchId: 'm-4', slot: 4, session: 'sat-pm', nine: null, winner: 'og', label: '3&2',
    });
  });

  it('names the nine for 18-hole matches', () => {
    // Level through 8, so the front nine is decided on the 9th.
    const front = Array<HoleOutcome>(8).fill('halved');
    const events = diffEvents(
      [match('fri-2', front, { holeCount: 18, session: 'fri' })],
      [match('fri-2', [...front, 'south'], { holeCount: 18, session: 'fri' })],
    );
    expect(events.find(e => e.kind === 'point')).toMatchObject({ nine: 'front', winner: 'south' });
  });

  it('reports a lead change once points exist', () => {
    const almost = Array<HoleOutcome>(8).fill('halved');
    const events = diffEvents([match('m-1', almost)], [match('m-1', [...almost, 'og'])]);
    expect(events).toContainEqual({ kind: 'lead', leader: 'og' });
  });

  it('reports the cup going level', () => {
    const won = match('m-1', Array(9).fill('og'));
    const almost = Array<HoleOutcome>(8).fill('halved');
    const events = diffEvents([won, match('m-2', almost)], [won, match('m-2', [...almost, 'south'])]);
    expect(events).toContainEqual({ kind: 'lead', leader: null });
  });

  it('reports only a clinch for bulk rewrites', () => {
    const before = Array.from({ length: 36 }, (_, i) => match(`m-${i + 1}`, []));
    const after = before.map((m, i) => match(m.id, Array(9).fill(i < 18 ? 'og' : 'south')));
    expect(diffEvents(before, after)).toEqual([{ kind: 'clinch', team: 'og', how: 'retains' }]);
  });

  it('stays quiet for bulk rewrites that do not clinch', () => {
    const before = Array.from({ length: 6 }, (_, i) => match(`m-${i + 1}`, []));
    const after = before.map(m => match(m.id, ['og', 'south']));
    expect(diffEvents(before, after)).toEqual([]);
  });
});
