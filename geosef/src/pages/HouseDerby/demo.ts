// Demo states for showing the boards before the event. Each scenario builds
// believable hole-by-hole results by rolling random holes and keeping rolls
// the real scoring rules agree with (a target winner, or still live).
import type { Match } from './data';
import { segments, segmentState, type HoleEntry, type HoleOutcome, type MatchScoring, type TeamId } from './scoring';

type Holes = Record<string, HoleEntry>;
/** What one nine should look like: untouched, mid-round, or decided for a side. */
type NinePlan = 'empty' | 'live' | { winner: TeamId | null };

function rollHole(): HoleOutcome {
  const r = Math.random();
  return r < 0.36 ? 'og' : r < 0.72 ? 'south' : 'halved';
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

type Session = 'fri' | 'sat-am' | 'sat-mid' | 'sat-pm';

export interface Scenario {
  id: string;
  label: string;
  /** Session -> how each of its nines should look. */
  plan: (session: Session, nines: number) => NinePlan[];
}

const decided = (winners: Array<TeamId | null>): NinePlan[] => winners.map(w => ({ winner: w }));
const random = (n: number): NinePlan[] => decided(Array.from({ length: n }, () => {
  const r = Math.random();
  return r < 0.42 ? 'og' : r < 0.84 ? 'south' : null;
}));
const all = (n: number, p: NinePlan): NinePlan[] => Array(n).fill(p);

export const SCENARIOS: Scenario[] = [
  { id: 'fresh', label: 'Fresh', plan: (_, n) => all(n, 'empty') },
  {
    id: 'fri-live', label: 'Friday live',
    // Wave 1 (matches 1-3, front+back each) on the back nine; wave 2 not out yet.
    plan: (s, n) => (s === 'fri' ? [...random(3).flatMap(f => [f, 'live' as NinePlan]).slice(0, 6), ...all(n - 6, 'empty')] : all(n, 'empty')),
  },
  { id: 'fri-done', label: 'Friday done', plan: (s, n) => (s === 'fri' ? random(n) : all(n, 'empty')) },
  {
    id: 'am-live', label: 'Saturday AM live',
    plan: (s, n) => (s === 'fri' ? random(n) : s === 'sat-am' ? all(n, 'live') : all(n, 'empty')),
  },
  {
    id: 'singles-tight', label: 'Singles, tight race',
    // 12-12 after four sessions, then singles mostly live with a few finished.
    plan: (s, n) => {
      if (s === 'fri') return decided(split(n, 6));
      if (s === 'sat-am') return decided(split(n, 3));
      if (s === 'sat-mid') return decided(split(n, 3));
      return shuffle([...random(3), ...all(n - 3, 'live')]);
    },
  },
  {
    id: 'og-ties', label: 'OG wins 18–18',
    plan: (s, n) => decided(split(n, { fri: 6, 'sat-am': 3, 'sat-mid': 3, 'sat-pm': 6 }[s])),
  },
  {
    id: 'south-wins', label: 'South wins 19½–16½',
    plan: (s, n) => decided(split(n, { fri: 5.5, 'sat-am': 3, 'sat-mid': 2.5, 'sat-pm': 5.5 }[s])),
  },
];

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
export function pickNextHole(matches: Match[], sessionOrder: string[]): { matchId: string; hole: number; result: HoleOutcome } | null {
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
      return { matchId: pick.m.id, hole: pick.hole, result: rollHole() };
    }
  }
  return null;
}
