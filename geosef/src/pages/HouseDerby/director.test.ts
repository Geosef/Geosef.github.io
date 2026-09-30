import { describe, expect, it } from 'vitest';
import { DWELL, playlist, segmentAt, type Segment } from './director';
import type { HoleOutcome } from './scoring';

const sessions = [
  { id: 'w1', order: 1 },
  { id: 'w2', order: 2 },
];

// One nine per match. 'final' plays out a 5&4 win; 'live' is two holes in.
const match = (session: string, state: 'empty' | 'live' | 'final') => {
  const results: HoleOutcome[] = state === 'empty' ? [] : state === 'live' ? ['og', 'south'] : ['og', 'og', 'og', 'og', 'og'];
  return {
    session,
    strokes: { og: [], south: [] },
    holes: Object.fromEntries(results.map((r, i) => [i + 1, { result: r }])),
  };
};

describe('playlist', () => {
  it('holds on the board while anything is live', () => {
    expect(playlist(sessions, [match('w1', 'final'), match('w1', 'live'), match('w2', 'empty')])).toEqual([{ kind: 'board' }]);
  });

  it('previews the first stage before anything is played', () => {
    expect(playlist(sessions, [match('w1', 'empty'), match('w2', 'empty')])).toEqual([
      { kind: 'board' },
      { kind: 'next', session: 'w1' },
    ]);
  });

  it('recaps the stage just played and previews the next', () => {
    expect(playlist(sessions, [match('w1', 'final'), match('w1', 'final'), match('w2', 'empty')])).toEqual([
      { kind: 'board' },
      { kind: 'recap', session: 'w1' },
      { kind: 'next', session: 'w2' },
    ]);
  });

  it('holds through a lull mid-stage (between nines, staggered starts)', () => {
    expect(playlist(sessions, [match('w1', 'final'), match('w1', 'empty'), match('w2', 'empty')])).toEqual([{ kind: 'board' }]);
  });

  it('pinned mid-stage: recaps and previews the same stage', () => {
    expect(playlist(sessions, [match('w1', 'final'), match('w1', 'empty'), match('w2', 'empty')], true)).toEqual([
      { kind: 'board' },
      { kind: 'recap', session: 'w1' },
      { kind: 'next', session: 'w1' },
    ]);
  });

  it('after the last match, recaps the final stage', () => {
    expect(playlist(sessions, [match('w1', 'final'), match('w2', 'final')])).toEqual([
      { kind: 'board' },
      { kind: 'recap', session: 'w2' },
    ]);
  });
});

describe('segmentAt', () => {
  const list: Segment[] = [{ kind: 'board' }, { kind: 'recap', session: 'w1' }, { kind: 'next', session: 'w2' }];
  const cycle = DWELL.board + DWELL.recap + DWELL.next;

  it('walks the list by dwell time and wraps', () => {
    expect(segmentAt(list, 0).segment.kind).toBe('board');
    expect(segmentAt(list, DWELL.board).segment.kind).toBe('recap');
    expect(segmentAt(list, DWELL.board + DWELL.recap).segment.kind).toBe('next');
    expect(segmentAt(list, cycle).segment.kind).toBe('board');
  });

  it('reports time left in the segment', () => {
    expect(segmentAt(list, cycle * 7 + 1000).endsIn).toBe(DWELL.board - 1000);
  });

  it('a lone board never changes', () => {
    expect(segmentAt([{ kind: 'board' }], 123_456).segment).toEqual({ kind: 'board' });
  });
});
