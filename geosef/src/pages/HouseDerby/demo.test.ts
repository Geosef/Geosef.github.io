import { describe, expect, it } from 'vitest';
import { SCENARIOS, buildScenario, pickNextHole } from './demo';
import { cupStanding, matchStates } from './scoring';
import type { Match } from './data';

// Same layout as sessions.json: 6 indoor pairings as front and back nines,
// then three outdoor sessions.
const outdoor: Array<[string, number]> = [['sat-am', 6], ['sat-mid', 6], ['sat-pm', 12]];
const base = { players: { og: [], south: [] }, strokes: { og: [], south: [] }, holes: {}, pending: false };
const blank: Match[] = [
  ...Array.from({ length: 6 }, (_, i) => (['front', 'back'] as const).map(nine => ({
    ...base, id: `fri-${i + 1}-${nine}`, session: 'fri', slot: i + 1, nine, firstHole: nine === 'back' ? 10 : 1,
  }))).flat(),
  ...outdoor.flatMap(([session, count]) => Array.from({ length: count }, (_, i) => ({
    ...base, id: `${session}-${i + 1}`, session, slot: i + 1,
  }))),
];

function run(id: string) {
  const holes = buildScenario(SCENARIOS.find(s => s.id === id)!, blank);
  return blank.map(m => ({ ...m, holes: holes[m.id] ?? {} }));
}
const phases = (ms: Match[], session: string) => ms.filter(m => m.session === session).flatMap(m => matchStates(m).map(s => s.phase));

// Scenarios are random, so run each several times.
const REPEAT = 25;

describe('demo scenarios', () => {
  it('fresh clears everything', () => {
    expect(cupStanding(run('fresh')).points).toEqual({ og: 0, south: 0 });
    expect(phases(run('fresh'), 'fri').every(p => p === 'not-started')).toBe(true);
  });

  it('friday live has wave 1 on the back nine and wave 2 unstarted', () => {
    for (let i = 0; i < REPEAT; i++) {
      const fri = phases(run('fri-live'), 'fri');
      expect(fri.slice(0, 6)).toEqual(['final', 'live', 'final', 'live', 'final', 'live']);
      expect(fri.slice(6).every(p => p === 'not-started')).toBe(true);
    }
  });

  it('friday done decides all 12 indoor points and nothing else', () => {
    const ms = run('fri-done');
    const s = cupStanding(ms);
    expect(s.points.og + s.points.south).toBe(12);
    expect(phases(ms, 'sat-am').every(p => p === 'not-started')).toBe(true);
  });

  it('saturday AM live has every scramble match in progress', () => {
    for (let i = 0; i < REPEAT; i++) {
      expect(phases(run('am-live'), 'sat-am').every(p => p === 'live')).toBe(true);
    }
  });

  it('singles tight race is 12-12 before singles', () => {
    for (let i = 0; i < REPEAT; i++) {
      const ms = run('singles-tight');
      const before = cupStanding(ms.filter(m => m.session !== 'sat-pm'));
      expect(before.points).toEqual({ og: 12, south: 12 });
      const pm = phases(ms, 'sat-pm');
      expect(pm.filter(p => p === 'final')).toHaveLength(3);
      expect(pm.filter(p => p === 'live')).toHaveLength(9);
    }
  });

  it('OG wins at 18-18', () => {
    for (let i = 0; i < REPEAT; i++) {
      const s = cupStanding(run('og-ties'));
      expect(s.points).toEqual({ og: 18, south: 18 });
      expect(s.clinched).toBe('og');
    }
  });

  it('South wins 19.5-16.5', () => {
    for (let i = 0; i < REPEAT; i++) {
      const s = cupStanding(run('south-wins'));
      expect(s.points).toEqual({ og: 16.5, south: 19.5 });
      expect(s.clinched).toBe('south');
    }
  });

  it('never leaves holes entered after a nine was decided', () => {
    for (const sc of SCENARIOS) {
      for (const m of run(sc.id)) {
        for (const st of matchStates(m)) expect(st.afterClose).toEqual([]);
      }
    }
  });
});

describe('pickNextHole', () => {
  const order = ['fri', 'sat-am', 'sat-mid', 'sat-pm'];

  it('starts with the first session', () => {
    expect(pickNextHole(blank, order)).toMatchObject({ hole: 1, matchId: expect.stringMatching(/^fri-/) });
  });

  it('never starts a back nine before its front nine is decided', () => {
    let ms = blank;
    for (let i = 0; i < 400; i++) {
      const next = pickNextHole(ms, order);
      if (!next) break;
      const m = ms.find(x => x.id === next.matchId)!;
      if (m.nine === 'back') {
        const front = ms.find(x => x.session === m.session && x.slot === m.slot && x.nine === 'front')!;
        expect(matchStates(front)[0].phase).toBe('final');
      }
      ms = ms.map(x => (x.id === next.matchId ? { ...x, holes: { ...x.holes, [next.hole]: { result: next.result } } } : x));
    }
  });

  it('plays a match through to the end and then moves on', () => {
    let ms = blank;
    for (let i = 0; i < 2000; i++) {
      const next = pickNextHole(ms, order);
      if (!next) break;
      ms = ms.map(m => (m.id === next.matchId ? { ...m, holes: { ...m.holes, [next.hole]: { result: next.result } } } : m));
    }
    expect(pickNextHole(ms, order)).toBeNull();
    // Every point decided, nothing entered after a nine was decided.
    const s = cupStanding(ms);
    expect(s.points.og + s.points.south).toBe(36);
    for (const m of ms) for (const st of matchStates(m)) expect(st.afterClose).toEqual([]);
  });
});
