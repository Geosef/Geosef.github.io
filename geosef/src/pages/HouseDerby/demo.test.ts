import { describe, expect, it } from 'vitest';
import { SCENARIOS, buildScenario } from './demo';
import { cupStanding, matchStates } from './scoring';
import type { Match } from './data';

// Same layout as sessions.json: 6 indoor 18-hole matches, then three 9-hole sessions.
const layout: Array<[string, number, 9 | 18]> = [['fri', 6, 18], ['sat-am', 6, 9], ['sat-mid', 6, 9], ['sat-pm', 12, 9]];
const blank: Match[] = layout.flatMap(([session, count, holeCount]) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${session}-${i + 1}`, session, slot: i + 1, holeCount,
    players: { og: [], south: [] }, strokes: { og: [], south: [] }, holes: {}, pending: false,
  })));

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

  it('OG retains at 18-18', () => {
    for (let i = 0; i < REPEAT; i++) {
      const s = cupStanding(run('og-retains'));
      expect(s.points).toEqual({ og: 18, south: 18 });
      expect(s.clinched).toEqual({ team: 'og', how: 'retains' });
    }
  });

  it('South wins 19.5-16.5', () => {
    for (let i = 0; i < REPEAT; i++) {
      const s = cupStanding(run('south-wins'));
      expect(s.points).toEqual({ og: 16.5, south: 19.5 });
      expect(s.clinched).toEqual({ team: 'south', how: 'wins' });
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
