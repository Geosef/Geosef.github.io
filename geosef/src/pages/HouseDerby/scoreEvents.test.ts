import { describe, expect, it } from 'vitest';
import { diffEvents, latestMoment, type EventMatch } from './scoreEvents';
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

  it('names the nine for indoor matches', () => {
    // Level through 8, so the back nine is decided on the 9th.
    const holes = Object.fromEntries([...Array(8).keys()].map(i => [10 + i, { result: 'halved' as const }]));
    const back = (extra: Record<number, { result: HoleOutcome }>): EventMatch => ({
      id: 'fri-2-back', slot: 2, session: 'fri', nine: 'back', firstHole: 10,
      strokes: { og: [], south: [] }, holes: { ...holes, ...extra },
    });
    const events = diffEvents([back({})], [back({ 18: { result: 'south' } })]);
    expect(events.find(e => e.kind === 'point')).toMatchObject({ nine: 'back', winner: 'south', slot: 2 });
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
    expect(diffEvents(before, after)).toEqual([{ kind: 'clinch', team: 'og' }]);
  });

  it('stays quiet for bulk rewrites that do not clinch', () => {
    const before = Array.from({ length: 6 }, (_, i) => match(`m-${i + 1}`, []));
    const after = before.map(m => match(m.id, ['og', 'south']));
    expect(diffEvents(before, after)).toEqual([]);
  });
});

describe('latestMoment', () => {
  const OG_5_AND_4: HoleOutcome[] = ['og', 'og', 'og', 'og', 'og'];

  it('is empty before any nine finishes', () => {
    expect(latestMoment([match('m-1', ['og', 'south'])])).toEqual([]);
  });

  it('replays the most recently scored finish: closing hole, the point, then the lead it swung', () => {
    const early = match('m-1', ['south', 'south', 'south', 'south', 'south'], { updatedAt: 1 });
    const late = match('m-2', OG_5_AND_4, { updatedAt: 2 });
    expect(latestMoment([early, late])).toEqual([
      { kind: 'hole', matchId: 'm-2', result: 'og' },
      { kind: 'point', matchId: 'm-2', slot: 2, session: 'sat-pm', nine: null, winner: 'og', label: '5&4' },
      { kind: 'lead', leader: null },
    ]);
  });

  it('leaves out the lead when the point did not change it', () => {
    const a = match('m-1', OG_5_AND_4, { updatedAt: 1 });
    const b = match('m-2', OG_5_AND_4, { updatedAt: 2 });
    expect(latestMoment([a, b]).map(e => e.kind)).toEqual(['hole', 'point']);
  });

  it('a named older match replays without a lead change (its "before" is stale)', () => {
    const a = match('m-1', OG_5_AND_4, { updatedAt: 1 });
    const b = match('m-2', ['south', 'south', 'south', 'south', 'south'], { updatedAt: 2 });
    expect(latestMoment([a, b], 'm-1').map(e => e.kind)).toEqual(['hole', 'point']);
  });

  it('closes on the deciding hole, not holes entered after it', () => {
    const m = match('m-1', [...OG_5_AND_4, 'south'], { updatedAt: 1 });
    expect(latestMoment([m])[0]).toEqual({ kind: 'hole', matchId: 'm-1', result: 'og' });
  });

  it('replays a named match', () => {
    const a = match('m-1', OG_5_AND_4, { updatedAt: 1 });
    const b = match('m-2', OG_5_AND_4, { updatedAt: 2 });
    expect(latestMoment([a, b], 'm-1').pop()).toMatchObject({ kind: 'point', matchId: 'm-1' });
  });
});
