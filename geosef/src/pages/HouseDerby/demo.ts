// Demo states for showing the boards before the event. Each scenario builds
// believable hole-by-hole results by rolling random holes and keeping rolls
// the real scoring rules agree with (a target winner, or still live).
import type { Match } from './data';
import { segments, segmentState, type HoleEntry, type HoleOutcome, type MatchScoring, type TeamId } from './scoring';

type Holes = Record<string, HoleEntry>;
/** What one nine should look like: untouched, mid-round, or decided for a side. */
type NinePlan = 'empty' | 'live' | { winner: TeamId | null };

/** A random hole result. `lean` > 0 favors OG, < 0 South (0.06 is a mild edge). */
function rollHole(lean = 0): HoleOutcome {
  const r = Math.random();
  return r < 0.36 + lean ? 'og' : r < 0.72 ? 'south' : 'halved';
}

/** Random results for one nine that satisfy the plan. */
function rollNine(order: number[], plan: NinePlan): Holes {
  if (plan === 'empty') return {};
  for (let attempt = 0; attempt < 2000; attempt++) {
    const holes: Holes = {};
    const played = plan === 'live' ? 2 + Math.floor(Math.random() * 6) : order.length;
    for (const h of order.slice(0, played)) holes[h] = { result: rollHole() };
    const probe: MatchScoring = { strokes: { og: [], south: [] }, holes };
    const state = segmentState(probe, order);
    if (plan === 'live' ? state.phase === 'live' : state.phase === 'final' && state.winner === plan.winner) {
      // Stop entering once a nine is decided, as a marshal would.
      for (const h of state.afterClose) delete holes[h];
      return holes;
    }
  }
  throw new Error('Could not roll a nine for the plan');
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Winners for `count` nines so OG totals exactly `ogPoints` (halves allowed). */
function split(count: number, ogPoints: number): Array<TeamId | null> {
  let halves = (ogPoints * 2) % 2 === 1 ? 1 : 0;
  // A couple of extra halves reads more like real golf when there's room.
  while (halves + 2 <= count && ogPoints - (halves + 2) / 2 >= 0 && count - ogPoints - (halves + 2) / 2 >= 0 && halves < 3) halves += 2;
  const og = ogPoints - halves / 2;
  const south = count - og - halves;
  if (og < 0 || south < 0 || !Number.isInteger(og)) throw new Error(`Can't split ${count} nines to ${ogPoints}`);
  return shuffle([...Array(og).fill('og'), ...Array(south).fill('south'), ...Array(halves).fill(null)]);
}

type Session = 'fri-w1' | 'fri-w2' | 'sat-am' | 'sat-mid' | 'sat-pm';
const STAGES: Session[] = ['fri-w1', 'fri-w2', 'sat-am', 'sat-mid', 'sat-pm'];
const INDOOR: Session[] = ['fri-w1', 'fri-w2'];

/** How the Derby ends. Each has a route with some lead changes on the way. */
export const OUTCOMES = [
  // OG points per stage (of 6, 6, 6, 6, 12).
  { id: 'og', label: 'OG outright', lean: 0.06, split: { 'fri-w1': 2.5, 'fri-w2': 3.5, 'sat-am': 4, 'sat-mid': 3, 'sat-pm': 7 } },
  { id: 'south', label: 'South outright', lean: -0.06, split: { 'fri-w1': 3.5, 'fri-w2': 2, 'sat-am': 3, 'sat-mid': 2.5, 'sat-pm': 5.5 } },
  { id: 'tie', label: 'OG on the tiebreak', lean: 0, split: { 'fri-w1': 2.5, 'fri-w2': 3.5, 'sat-am': 2, 'sat-mid': 4, 'sat-pm': 6 } },
] as const satisfies ReadonlyArray<{ id: string; label: string; lean: number; split: Record<Session, number> }>;
export type Outcome = (typeof OUTCOMES)[number];

const decided = (winners: Array<TeamId | null>): NinePlan[] => winners.map(w => ({ winner: w }));
const all = (n: number, p: NinePlan): NinePlan[] => Array(n).fill(p);

/** Where the tournament stands: each stage untouched, in play, or done. */
type StageState = 'empty' | 'live' | 'done';

export interface Phase {
  id: string;
  label: string;
  stages: Partial<Record<Session, StageState>>;
}

const through = (done: number, live?: Session): Phase['stages'] => ({
  ...Object.fromEntries(STAGES.slice(0, done).map(s => [s, 'done'])),
  ...(live ? { [live]: 'live' } : {}),
});

export const PHASES: Phase[] = [
  { id: 'fresh', label: 'Before', stages: {} },
  { id: 'w1-live', label: 'Alt 1 live', stages: through(0, 'fri-w1') },
  { id: 'w1-done', label: 'Alt 1 done', stages: through(1) },
  { id: 'w2-live', label: 'Alt 2 live', stages: through(1, 'fri-w2') },
  { id: 'fri-done', label: 'Friday done', stages: through(2) },
  { id: 'am-live', label: 'Scramble live', stages: through(2, 'sat-am') },
  { id: 'am-done', label: 'Scramble done', stages: through(3) },
  { id: 'mid-live', label: 'Mod Alt live', stages: through(3, 'sat-mid') },
  { id: 'mid-done', label: 'Mod Alt done', stages: through(4) },
  { id: 'pm-live', label: 'Singles live', stages: through(4, 'sat-pm') },
  { id: 'final', label: 'Final', stages: through(5) },
];

/**
 * One stage's nines under a phase and outcome. Done stages play out the
 * outcome's split. Live ones look like a real mid-stage moment: indoor waves
 * have fronts decided and backs in play; outdoor stages tee off in slot
 * order, so early slots are finished, the middle live and the last few not
 * out yet.
 */
function stagePlan(session: Session, nines: number, state: StageState, outcome: Outcome): NinePlan[] {
  if (state === 'empty') return all(nines, 'empty');
  const results = decided(split(nines, outcome.split[session]));
  if (state === 'done') return results;
  if (INDOOR.includes(session)) return results.map((r, i) => (i % 2 ? 'live' : r));
  const finished = Math.floor(nines / 3);
  const out = Math.ceil(nines * 0.75);
  return results.map((r, i) => (i < finished ? r : i < out ? 'live' : 'empty'));
}

export interface Scenario {
  id: string;
  label: string;
  /** Session -> how each of its nines should look, in slot order. */
  plan: (session: Session, nines: number) => NinePlan[];
}

export function scenario(phase: Phase, outcome: Outcome): Scenario {
  return {
    id: `${phase.id}:${outcome.id}`,
    label: `${phase.label} · ${outcome.label}`,
    plan: (s, n) => stagePlan(s, n, phase.stages[s] ?? 'empty', outcome),
  };
}

/** Hole maps for every match under a scenario. */
export function buildScenario(scenario: Scenario, matches: Match[]): Record<string, Holes> {
  const bySession = new Map<string, Match[]>();
  const nineOrder = (m: Match) => (m.nine === 'back' ? 1 : 0);
  for (const m of [...matches].sort((a, b) => a.slot - b.slot || nineOrder(a) - nineOrder(b))) {
    bySession.set(m.session, [...(bySession.get(m.session) ?? []), m]);
  }
  const out: Record<string, Holes> = {};
  for (const [session, list] of bySession) {
    const nineOrders = list.flatMap(m => segments(m).map(order => ({ m, order })));
    const plans = scenario.plan(session as Session, nineOrders.length);
    nineOrders.forEach(({ m, order }, i) => {
      out[m.id] = { ...(out[m.id] ?? {}), ...rollNine(order, plans[i] ?? 'empty') };
    });
  }
  return out;
}

/**
 * The next hole to play in a simulated round: a random unfinished match in the
 * earliest session that still has play left, at its next unplayed hole.
 */
export function pickNextHole(matches: Match[], sessionOrder: string[], lean = 0): { matchId: string; hole: number; result: HoleOutcome } | null {
  for (const session of sessionOrder) {
    const open = matches
      .filter(m => m.session === session)
      .map(m => {
        // A pairing's back nine starts only once its front nine is decided.
        if (m.nine === 'back') {
          const front = matches.find(f => f.session === m.session && f.slot === m.slot && f.nine === 'front');
          if (front && segments(front).some(order => segmentState(front, order).phase !== 'final')) return null;
        }
        // First nine that isn't decided, and its next empty hole.
        const nine = segments(m).find(order => segmentState(m, order).phase !== 'final');
        const hole = nine?.find(h => !m.holes[h]?.result);
        return hole ? { m, hole } : null;
      })
      .filter((x): x is { m: Match; hole: number } => x !== null);
    if (open.length) {
      const pick = open[Math.floor(Math.random() * open.length)];
      return { matchId: pick.m.id, hole: pick.hole, result: rollHole(lean) };
    }
  }
  return null;
}

/** Tournament-flow auto-play: where the simulation is. */
export interface FlowState {
  stage: string | null;
  /** Ticks since the stage's first tee (its tee sheet runs off this). */
  ticks: number;
  /** Dead time between stages runs until this (ms since epoch). */
  deadUntil: number;
}

export const FLOW_START: FlowState = { stage: null, ticks: 0, deadUntil: 0 };

export type FlowStep =
  | { kind: 'hole'; state: FlowState; play: { matchId: string; hole: number; result: HoleOutcome } }
  | { kind: 'dead'; state: FlowState; next: string; msLeft: number }
  | { kind: 'wait'; state: FlowState }
  | { kind: 'done'; state: FlowState };

/**
 * One tick of a simulated tournament, played the way the day runs. Stages
 * go in order. Within a stage, outdoor slots tee off `stagger` ticks apart
 * (indoor bays all go together), a back nine starts once its front is
 * decided, and each tick scores one hole in a random match on the course, so
 * the boards animate hole by hole as they would live. When a stage finishes,
 * `deadMs` of dead time passes before the next tees off, so the TV's
 * dead-time rotation plays.
 */
export function flowStep(matches: Match[], sessionOrder: string[], state: FlowState, opts: {
  now: number; stagger: number; deadMs: number; lean: number;
}): FlowStep {
  const open = (m: Match) => segments(m).some(order => segmentState(m, order).phase !== 'final');
  const stage = sessionOrder.find(s => matches.some(m => m.session === s && open(m)));
  if (!stage) return { kind: 'done', state };

  let st = state;
  if (st.stage !== stage) {
    // A stage just finished (or the run just began mid-tournament): dead time
    // first, unless nothing has been played before this stage.
    const previousPlayed = sessionOrder.slice(0, sessionOrder.indexOf(stage))
      .some(s => matches.some(m => m.session === s && Object.keys(m.holes).length));
    const started = matches.some(m => m.session === stage && Object.keys(m.holes).length);
    st = { stage, ticks: 0, deadUntil: previousPlayed && !started ? opts.now + opts.deadMs : 0 };
  }
  if (opts.now < st.deadUntil) return { kind: 'dead', state: st, next: stage, msLeft: st.deadUntil - opts.now };

  const indoor = matches.some(m => m.session === stage && m.nine);
  const onCourse = matches
    .filter(m => m.session === stage && (indoor || st.ticks >= (m.slot - 1) * opts.stagger))
    .map(m => {
      // A pairing's back nine starts only once its front nine is decided.
      if (m.nine === 'back') {
        const front = matches.find(f => f.session === m.session && f.slot === m.slot && f.nine === 'front');
        if (front && open(front)) return null;
      }
      const nine = segments(m).find(order => segmentState(m, order).phase !== 'final');
      const hole = nine?.find(h => !m.holes[h]?.result);
      return hole ? { m, hole } : null;
    })
    .filter((x): x is { m: Match; hole: number } => x !== null);
  const next = { ...st, ticks: st.ticks + 1 };
  if (!onCourse.length) return { kind: 'wait', state: next };
  const pick = onCourse[Math.floor(Math.random() * onCourse.length)];
  return { kind: 'hole', state: next, play: { matchId: pick.m.id, hole: pick.hole, result: rollHole(opts.lean) } };
}
