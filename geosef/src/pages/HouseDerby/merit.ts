// Season Order of Merit results -> what a player's roster card says. The
// points system pays for qualifying rounds and participation, so points alone
// mislead; per event we keep the one row that says how far they got.
//
// - Participation: 5 points or less whatever the position (flight places pay
//   participation), plus Camp Gimme / scout trips and "Participation" rows.
// - Qualifiers: made the field but didn't finish placed ("Qualified", a
//   playoff "CUT").
// - Finishes: everything else, ranked by place. Bracket results map to an
//   equivalent place (Runner Up 2, Semi Finalist 3, Round of 16 9...).
// Within an event, the highest-paying row is the real result: a qualifying
// round's "1st" gives way to the final's 4th.

export interface MeritResult { event: string; tournament: string; date: string; position: string; points: number }
export interface Merit { points: number; events: number; results: MeritResult[] }

export interface Finish { event: string; label: string; place: number }
export interface Accolades {
  finishes: Finish[];
  qualifiers: string[];
  /** Events they took part in, with how many times (Summer League months). */
  participation: Array<{ event: string; times: number }>;
}

const PARTICIPATION_MAX = 5;

/** "Spring Fling 2026" -> "Spring Fling"; Club Championship keeps its division. */
function eventName(r: MeritResult): string {
  const base = r.event.replace(/\s+(19|20)\d\d$/, '');
  const division = r.tournament.match(/\b(Gross|Net) Division\b/)?.[1];
  return division ? `${base} (${division})` : base;
}

const isTrip = (r: MeritResult) => /Camp Gimme|Scout Trip/i.test(r.event) || /Camper/i.test(r.tournament);
const isParticipation = (r: MeritResult) =>
  r.points <= PARTICIPATION_MAX || isTrip(r) || /Partic|Partis/i.test(r.tournament) || /Participated/i.test(r.tournament);
const isQualifier = (r: MeritResult) => /^Qualified$/i.test(r.tournament) || /^CUT$/i.test(r.position);

/** Equivalent place for sorting and labels; null when there isn't one. */
export function place(position: string): number | null {
  const n = position.match(/^T?(\d+)$/);
  if (n) return Number(n[1]);
  if (/runner.?up/i.test(position)) return 2;
  if (/semi/i.test(position)) return 3;
  if (/quarter/i.test(position)) return 5;
  const round = position.match(/round of (\d+)/i);
  if (round) return Number(round[1]) / 2 + 1;
  return null;
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** "1st", "T4", "Runner-up", "Semi-finalist", "Round of 32". */
function finishLabel(position: string): string {
  const n = position.match(/^(T?)(\d+)$/);
  if (n) return n[1] ? `T${n[2]}` : ordinal(Number(n[2]));
  if (/runner.?up/i.test(position)) return 'Runner-up';
  if (/semi/i.test(position)) return 'Semi-finalist';
  if (/quarter/i.test(position)) return 'Quarterfinalist';
  return position.replace(/\bround\b/i, 'Round');
}

export function accolades(merit: Merit | undefined): Accolades {
  const out: Accolades = { finishes: [], qualifiers: [], participation: [] };
  if (!merit) return out;
  const byEvent = new Map<string, MeritResult[]>();
  for (const r of merit.results) byEvent.set(r.event, [...(byEvent.get(r.event) ?? []), r]);

  const participation = new Map<string, number>();
  for (const rows of byEvent.values()) {
    const scored = rows.filter(r => !isParticipation(r));
    if (!scored.length) {
      // Monthly rows ("Participation - May") count as several times; any other
      // mix of rows for one event is still one event.
      const name = eventName(rows[0]);
      const months = rows.filter(r => /Participation\s*-\s*\w+/i.test(r.tournament)).length;
      participation.set(name, (participation.get(name) ?? 0) + Math.max(1, months));
      continue;
    }
    const best = scored.reduce((a, b) => (b.points > a.points ? b : a));
    const name = eventName(best);
    const p = place(best.position);
    if (isQualifier(best) || p === null) {
      out.qualifiers.push(/playoff/i.test(best.event) ? `${name.replace(/ Playoffs$/, '')} Playoff Qualifier` : `Qualified · ${name}`);
    } else {
      out.finishes.push({ event: name, label: finishLabel(best.position), place: p });
    }
  }
  out.finishes.sort((a, b) => a.place - b.place);
  out.participation = [...participation].map(([event, times]) => ({ event, times }));
  return out;
}
