// Seeds House Derby reference data into Firestore via the REST API, authed as
// the gcloud account that owns the project (no service-account key on disk).
//
//   SEED_ACCOUNT=you@example.com node cup-seed/seed.mjs [--reset-scores]
//
// Re-running is safe mid-event: match docs are written with an update mask
// covering only pairing fields, so entered scores are kept. --reset-scores
// wipes every hole score, concession and edit-log entry (clear test data
// before the event).
//
// Real names, marshal emails and pairings live in *.local.json (gitignored);
// only the session layout is committed.
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadMerit } from './merit.mjs';

const PROJECT = 'house-derby-2026';
const ACCOUNT = process.env.SEED_ACCOUNT;
if (!ACCOUNT) throw new Error('Set SEED_ACCOUNT to the gcloud account that owns the project');
const here = (f) => new URL(f, import.meta.url);
const load = (f) => JSON.parse(readFileSync(here(f), 'utf8'));

const roster = load('./roster.local.json');
const marshals = load('./marshals.local.json');
const { sessions, allowances } = load('./sessions.json');
// Optional until captains set them. Shape per session id, one entry per slot:
//   { "sat-am": [{ "og": ["smith", "jones"], "south": ["brown", "davis"],
//                  "strokes": { "og": [], "south": [3, 7] } }] }
// Stroke holes are course hole numbers; indoor pairings give 1-18 and they're
// split across the front (1-9) and back (10-18) nine matches.
const pairings = existsSync(here('./pairings.local.json')) ? load('./pairings.local.json') : {};
const resetScores = process.argv.includes('--reset-scores');
// Season Order of Merit per player, from order_of_merit/<id>.txt (gitignored).
const merit = loadMerit(here('./order_of_merit/'));

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
// Writes only the listed fields, leaving the rest of the doc (e.g. scores)
// alone. Paths in `remove` are in the mask but not the data, so they're deleted.
const merge = (path, data, remove = []) => ({ ...set(path, data), updateMask: { fieldPaths: [...Object.keys(data), ...remove] } });

const playerId = (p) => p.last.toLowerCase().replace(/[^a-z]/g, '');

const writes = [
  ...Object.entries(roster.teams).map(([id, t]) => set(`teams/${id}`, t)),
  ...roster.players.map((p) => set(`players/${playerId(p)}`, {
    first: p.first, last: p.last, team: p.team,
    ghin: p.ghin, trackman: p.trackman, captain: p.captain,
    ...(merit.has(playerId(p)) ? { merit: merit.get(playerId(p)) } : {}),
  })),
  ...sessions.map(({ id, ...s }) => set(`sessions/${id}`, s)),
  set('config/allowances', allowances),
  set('config/marshals', marshals),
];

// Tee time for one match, from the session's first tee (ISO with offset).
// Indoor back nines all start at backNineAt; outdoor matches go off
// teeInterval minutes apart in slot order.
function teeTime(session, slot, nine) {
  if (!session.startsAt) return null;
  if (nine === 'back' && session.backNineAt) return session.backNineAt;
  const at = new Date(Date.parse(session.startsAt) + (slot - 1) * (session.teeInterval ?? 0) * 60_000);
  // Keep the session's UTC offset so the stored string reads as local time.
  const offset = session.startsAt.slice(-6);
  const local = new Date(at.getTime() + offsetMinutes(offset) * 60_000).toISOString().slice(0, 19);
  return `${local}${offset}`;
}
const offsetMinutes = (o) => (o[0] === '-' ? -1 : 1) * (Number(o.slice(1, 3)) * 60 + Number(o.slice(4, 6)));

const playerIds = new Set(roster.players.map(playerId));
const matchIds = [];
for (const session of sessions) {
  for (let slot = 1; slot <= session.pairings; slot++) {
    const pairing = pairings[session.id]?.[slot - 1] ?? {};
    for (const t of ['og', 'south']) {
      for (const id of pairing[t] ?? []) {
        if (!playerIds.has(id)) throw new Error(`${session.id} slot ${slot}: unknown player "${id}"`);
      }
    }
    // Indoor pairings become two matches (front and back nine); others one.
    for (const nine of session.nines ?? [null]) {
      const id = nine ? `${session.id}-${slot}-${nine}` : `${session.id}-${slot}`;
      const firstHole = nine === 'back' ? 10 : 1;
      const inNine = (h) => h >= firstHole && h < firstHole + 9;
      matchIds.push(id);
      const fields = {
        session: session.id, slot, nine, firstHole, startHole: pairing.startHole ?? 1, teeTime: teeTime(session, slot, nine),
        players: { og: pairing.og ?? [], south: pairing.south ?? [] },
        strokes: { og: (pairing.strokes?.og ?? []).filter(inNine), south: (pairing.strokes?.south ?? []).filter(inNine) },
      };
      if (resetScores) Object.assign(fields, { holes: {}, concededBy: null });
      // holeCount is left over from when indoor pairings were one 18-hole doc.
      writes.push(merge(`matches/${id}`, fields, ['holeCount']));
    }
  }
}

if (playerIds.size !== roster.players.length) throw new Error('Duplicate player ids from last names');
for (const id of merit.keys()) if (!playerIds.has(id)) console.log(`Order of Merit file for unknown player: ${id}`);

const api = (path, init = {}) => fetch(`https://firestore.googleapis.com/v1/${path}`, {
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
});

// Matches left over from an older session layout, with their edit logs.
const stale = [];
{
  let pageToken = '';
  do {
    const r = await (await api(`${base}/matches?pageSize=300&mask.fieldPaths=session${pageToken && `&pageToken=${pageToken}`}`)).json();
    for (const d of r.documents ?? []) {
      const id = d.name.split('/').pop();
      if (!matchIds.includes(id)) stale.push(id);
    }
    pageToken = r.nextPageToken ?? '';
  } while (pageToken);
}

async function deleteEdits(id) {
  let pageToken = '';
  do {
    const r = await (await api(`${base}/matches/${id}/edits?pageSize=300&mask.fieldPaths=by${pageToken && `&pageToken=${pageToken}`}`)).json();
    for (const d of r.documents ?? []) writes.push({ delete: d.name });
    pageToken = r.nextPageToken ?? '';
  } while (pageToken);
}

// Sessions dropped from sessions.json.
{
  const r = await (await api(`${base}/sessions?pageSize=300&mask.fieldPaths=order`)).json();
  const keep = new Set(sessions.map((x) => x.id));
  for (const d of r.documents ?? []) {
    if (!keep.has(d.name.split('/').pop())) writes.push({ delete: d.name });
  }
}

for (const id of stale) {
  await deleteEdits(id);
  writes.push({ delete: `${base}/matches/${id}` });
}
if (stale.length) console.log(`Removing ${stale.length} matches no longer in sessions.json: ${stale.join(', ')}`);

if (resetScores) {
  // Edit logs are subcollections, so they aren't cleared by rewriting the match.
  for (const id of matchIds) await deleteEdits(id);
}

// Firestore caps a commit at 500 writes.
for (let i = 0; i < writes.length; i += 500) {
  const res = await api(`${base}:commit`, { method: 'POST', body: JSON.stringify({ writes: writes.slice(i, i + 500) }) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}
console.log(`Seeded ${writes.length} writes (${matchIds.length} matches${resetScores ? ', scores reset' : ''})`);
