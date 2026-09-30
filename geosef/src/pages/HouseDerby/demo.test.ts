import { describe, expect, it } from 'vitest';
import { FLOW_START, OUTCOMES, PHASES, buildScenario, flowStep, pickNextHole, scenario, type FlowState } from './demo';
import { cupStanding, matchStates, type HoleOutcome } from './scoring';
import type { Match } from './data';

// Same layout as sessions.json: two indoor waves of 3 pairings (front and
// back nines each), then three outdoor sessions.
const outdoor: Array<[string, number]> = [['sat-am', 6], ['sat-mid', 6], ['sat-pm', 12]];
const base = { players: { og: [], south: [] }, strokes: { og: [], south: [] }, holes: {}, pending: false };
const blank: Match[] = [
  ...['fri-w1', 'fri-w2'].flatMap(session => Array.from({ length: 3 }, (_, i) => (['front', 'back'] as const).map(nine => ({
    ...base, id: `${session}-${i + 1}-${nine}`, session, slot: i + 1, nine, firstHole: nine === 'back' ? 10 : 1,
  }))).flat()),
  ...outdoor.flatMap(([session, count]) => Array.from({ length: count }, (_, i) => ({
    ...base, id: `${session}-${i + 1}`, session, slot: i + 1,
  }))),
];

function run(phaseId: string, outcomeId = 'og') {
  const phase = PHASES.find(p => p.id === phaseId)!;
  const outcome = OUTCOMES.find(o => o.id === outcomeId)!;
  const holes = buildScenario(scenario(phase, outcome), blank);
  return blank.map(m => ({ ...m, holes: holes[m.id] ?? {} }));
}
const phases = (ms: Match[], session: string) => ms.filter(m => m.session === session).sort((a, b) => a.slot - b.slot || (a.nine === 'back' ? 1 : 0) - (b.nine === 'back' ? 1 : 0)).flatMap(m => matchStates(m).map(s => s.phase));

// Scenarios are random, so run each several times.
const REPEAT = 25;

describe('demo scenarios', () => {
  it('before: nothing played', () => {
    const ms = run('fresh');
    expect(cupStanding(ms).points).toEqual({ og: 0, south: 0 });
    expect(phases(ms, 'fri-w1').every(p => p === 'not-started')).toBe(true);
  });

  it('a live indoor wave has fronts decided and backs in play, later stages untouched', () => {
    for (let i = 0; i < REPEAT; i++) {
      const ms = run('w1-live');
      expect(phases(ms, 'fri-w1')).toEqual(['final', 'live', 'final', 'live', 'final', 'live']);
      expect(phases(ms, 'fri-w2').every(p => p === 'not-started')).toBe(true);
    }
  });

  it('friday done decides all 12 indoor points and nothing else', () => {
    const ms = run('fri-done');
    const s = cupStanding(ms);
    expect(s.points.og + s.points.south).toBe(12);
    expect(phases(ms, 'sat-am').every(p => p === 'not-started')).toBe(true);
  });

  it('a live outdoor stage looks staggered: early slots done, middle live, last not out', () => {
    for (let i = 0; i < REPEAT; i++) {
      const pm = phases(run('pm-live'), 'sat-pm');
      expect(pm).toEqual([...Array(4).fill('final'), ...Array(5).fill('live'), ...Array(3).fill('not-started')]);
    }
  });

  it('each outcome plays out its route to the final score', () => {
    const expected = { og: { og: 20, south: 16 }, south: { og: 16.5, south: 19.5 }, tie: { og: 18, south: 18 } };
    const winner = { og: 'og', south: 'south', tie: 'og' };
    for (const o of OUTCOMES) {
      for (let i = 0; i < REPEAT; i++) {
        const s = cupStanding(run('final', o.id));
        expect(s.points).toEqual(expected[o.id]);
        expect(s.clinched).toBe(winner[o.id]);
      }
    }
  });

  it('done stages follow the outcome route, so the lead changes along the way', () => {
    // OG outright: South lead after wave 1, level after Friday, OG from there.
    expect(cupStanding(run('w1-done')).points).toEqual({ og: 2.5, south: 3.5 });
    expect(cupStanding(run('fri-done')).points).toEqual({ og: 6, south: 6 });
    expect(cupStanding(run('am-done')).points).toEqual({ og: 10, south: 8 });
  });

  it('never leaves holes entered after a nine was decided', () => {
    for (const p of PHASES) {
      for (const o of OUTCOMES) {
        for (const m of run(p.id, o.id)) {
          for (const st of matchStates(m)) expect(st.afterClose).toEqual([]);
        }
      }
    }
  });
});

describe('pickNextHole', () => {
  const order = ['fri-w1', 'fri-w2', 'sat-am', 'sat-mid', 'sat-pm'];

  it('starts with the first session', () => {
    expect(pickNextHole(blank, order)).toMatchObject({ hole: 1, matchId: expect.stringMatching(/^fri-w1-.*-front$/) });
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

describe('flowStep (tournament flow)', () => {
  const order = ['fri-w1', 'fri-w2', 'sat-am', 'sat-mid', 'sat-pm'];
  const opts = { now: 1_000, stagger: 3, deadMs: 30_000, lean: 0 };
  const apply = (ms: Match[], p: { matchId: string; hole: number; result: HoleOutcome }) =>
    ms.map(m => (m.id === p.matchId ? { ...m, holes: { ...m.holes, [p.hole]: { result: p.result } } } : m));

  it('opens with a hole in the first stage when nothing has been played', () => {
    const step = flowStep(blank, order, FLOW_START, opts);
    expect(step.kind).toBe('hole');
    if (step.kind === 'hole') expect(step.play.matchId).toMatch(/^fri-w1-.*-front$/);
  });

  it('pauses for dead time when a stage finishes, then tees off the next', () => {
    const ms = run('fri-done');
    const dead = flowStep(ms, order, { stage: 'fri-w2', ticks: 50, deadUntil: 0 }, opts);
    expect(dead).toMatchObject({ kind: 'dead', next: 'sat-am', msLeft: 30_000 });
    const still = flowStep(ms, order, dead.state, { ...opts, now: 20_000 });
    expect(still.kind).toBe('dead');
    const teeOff = flowStep(ms, order, dead.state, { ...opts, now: 31_001 });
    expect(teeOff.kind).toBe('hole');
    // First tick of an outdoor stage: only slot 1 is out.
    if (teeOff.kind === 'hole') expect(teeOff.play.matchId).toBe('sat-am-1');
  });

  it('tees outdoor slots off in order, stagger ticks apart', () => {
    let ms: Match[] = run('fri-done');
    let state: FlowState = { stage: 'sat-am', ticks: 0, deadUntil: 0 };
    const firstTick = new Map<number, number>();
    for (let tick = 0; tick < 40; tick++) {
      const step = flowStep(ms, order, state, opts);
      state = step.state;
      if (step.kind !== 'hole') continue;
      const slot = ms.find(m => m.id === step.play.matchId)!.slot;
      if (!firstTick.has(slot)) firstTick.set(slot, tick);
      expect(tick).toBeGreaterThanOrEqual((slot - 1) * opts.stagger);
      ms = apply(ms, step.play);
    }
    expect([...firstTick.keys()].sort((a, b) => a - b).slice(0, 3)).toEqual([1, 2, 3]);
  });

  it('plays the whole tournament through, with a dead-time stop between every stage', () => {
    let ms = blank;
    let state = FLOW_START;
    let now = 0;
    const deadBefore = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const step = flowStep(ms, order, state, { ...opts, now });
      state = step.state;
      if (step.kind === 'done') break;
      if (step.kind === 'dead') { deadBefore.add(step.next); now += 5_000; continue; }
      if (step.kind === 'hole') ms = apply(ms, step.play);
      now += 100;
    }
    expect(cupStanding(ms).points.og + cupStanding(ms).points.south).toBe(36);
    expect([...deadBefore]).toEqual(['fri-w2', 'sat-am', 'sat-mid', 'sat-pm']);
    for (const m of ms) for (const st of matchStates(m)) expect(st.afterClose).toEqual([]);
  });
});
