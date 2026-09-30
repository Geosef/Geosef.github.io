// Parses season Order of Merit exports (cup-seed/order_of_merit/<player id>.txt,
// gitignored) into { points, events, results[] } for the team pages. The
// export's header holds "value / LABEL" pairs (points, age, height...); only
// the season points and event count are kept, not personal details.
import { existsSync, readFileSync, readdirSync } from 'node:fs';

export function parseMerit(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const table = lines.findIndex((l) => l.startsWith('Event\t'));
  if (table < 0) throw new Error('No results table (a line starting "Event<tab>")');
  const head = lines.slice(0, table);
  const stat = (label) => head[head.indexOf(label) - 1];
  const events = Number(head.find((l) => /Tournaments in \d{4} Season/.test(l))?.match(/^(\d+)/)?.[1] ?? 0);
  const results = lines.slice(table + 1).map((l) => {
    const [event, tournament, date, position, points] = l.split('\t').map((s) => s.trim());
    return { event, tournament, date, position, points: Number(points) };
  });
  return { points: Number(stat('POINTS') ?? 0), events, results };
}

/** Player id -> parsed merit, for every export in `dir` (empty if the folder's missing). */
export function loadMerit(dir) {
  if (!existsSync(dir)) return new Map();
  return new Map(readdirSync(dir).filter((f) => f.endsWith('.txt'))
    .map((f) => [f.replace(/\.txt$/, ''), parseMerit(readFileSync(new URL(f, dir), 'utf8'))]));
}
