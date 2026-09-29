// Seeds House Derby reference data into Firestore via the REST API, authed as
// the gcloud account that owns the project (no service-account key on disk).
//
//   SEED_ACCOUNT=you@example.com node cup-seed/seed.mjs
//
// Real names and marshal emails live in *.local.json (gitignored); only the
// session layout is committed.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PROJECT = 'house-derby-2026';
const ACCOUNT = process.env.SEED_ACCOUNT;
if (!ACCOUNT) throw new Error('Set SEED_ACCOUNT to the gcloud account that owns the project');
const here = (f) => new URL(f, import.meta.url);
const load = (f) => JSON.parse(readFileSync(here(f), 'utf8'));

const roster = load('./roster.local.json');
const marshals = load('./marshals.local.json');
const { sessions, allowances } = load('./sessions.json');

const token = execFileSync('gcloud', ['auth', 'print-access-token', `--account=${ACCOUNT}`], { encoding: 'utf8' }).trim();
const base = `projects/${PROJECT}/databases/(default)/documents`;

// Plain JS value -> Firestore REST Value.
function v(x) {
  if (x === null) return { nullValue: null };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(v) } };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'string') return { stringValue: x };
  return { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)])) } };
}
const set = (path, data) => ({ update: { name: `${base}/${path}`, fields: v(data).mapValue.fields } });

const playerId = (p) => p.last.toLowerCase().replace(/[^a-z]/g, '');

const writes = [
  ...Object.entries(roster.teams).map(([id, t]) => set(`teams/${id}`, t)),
  ...roster.players.map((p) => set(`players/${playerId(p)}`, {
    first: p.first, last: p.last, team: p.team,
    ghin: p.ghin, trackman: p.trackman, captain: p.captain,
  })),
  ...sessions.map(({ id, ...s }) => set(`sessions/${id}`, s)),
  set('config/allowances', allowances),
  set('config/marshals', marshals),
];

const ids = new Set(roster.players.map(playerId));
if (ids.size !== roster.players.length) throw new Error('Duplicate player ids from last names');

const res = await fetch(`https://firestore.googleapis.com/v1/${base}:commit`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ writes }),
});
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
console.log(`Seeded ${writes.length} docs`);
