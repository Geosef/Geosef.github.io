// Uploads player photos for the TV's up-next cards into Firestore
// (photos/{playerId}), authed as the project owner's gcloud account like
// seed.mjs. Photos never touch the repo: point this at a local folder.
//
//   SEED_ACCOUNT=you@example.com node cup-seed/photos.mjs <folder>
//   SEED_ACCOUNT=you@example.com node cup-seed/photos.mjs --clear
//
// Files are named for the player's id, i.e. their last name as seed.mjs
// makes it ("smith.jpg"). Each is squared and resized to a small JPEG with
// macOS `sips`, then stored inline as a data URL (a few KB, well under a
// Firestore doc's limit; no Storage bucket needed). Re-running replaces them.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';

const PROJECT = 'house-derby-2026';
const SIZE = 200;
const ACCOUNT = process.env.SEED_ACCOUNT;
if (!ACCOUNT) throw new Error('Set SEED_ACCOUNT to the gcloud account that owns the project');

const [arg] = process.argv.slice(2);
if (!arg) throw new Error('Usage: node cup-seed/photos.mjs <folder> | --clear');

const roster = JSON.parse(readFileSync(new URL('./roster.local.json', import.meta.url), 'utf8'));
// Same id rule as seed.mjs.
const playerId = (p) => p.last.toLowerCase().replace(/[^a-z]/g, '');
const ids = new Set(roster.players.map(playerId));

const token = execFileSync('gcloud', ['auth', 'print-access-token', `--account=${ACCOUNT}`], { encoding: 'utf8' }).trim();
const base = `projects/${PROJECT}/databases/(default)/documents`;
const commit = async (writes) => {
  for (let i = 0; i < writes.length; i += 500) {
    const res = await fetch(`https://firestore.googleapis.com/v1/${base}:commit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: writes.slice(i, i + 500) }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  }
};

if (arg === '--clear') {
  await commit([...ids].map((id) => ({ delete: `${base}/photos/${id}` })));
  console.log(`Cleared photos for ${ids.size} players`);
  process.exit(0);
}

const tmp = mkdtempSync(join(tmpdir(), 'derby-photos-'));
const writes = [];
const unknown = [];
for (const file of readdirSync(arg).filter((f) => /\.(jpe?g|png|heic|webp)$/i.test(f))) {
  const id = basename(file, extname(file)).toLowerCase().replace(/[^a-z]/g, '');
  if (!ids.has(id)) { unknown.push(file); continue; }
  const out = join(tmp, `${id}.jpg`);
  // Center-crop to a square, then shrink: portraits are circles.
  const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', join(arg, file)], { encoding: 'utf8' });
  const [w, h] = [...dims.matchAll(/: (\d+)/g)].map((m) => Number(m[1]));
  const side = Math.min(w, h);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '75', '-c', String(side), String(side), '-Z', String(SIZE), join(arg, file), '--out', out], { stdio: 'ignore' });
  const data = `data:image/jpeg;base64,${readFileSync(out).toString('base64')}`;
  writes.push({ update: { name: `${base}/photos/${id}`, fields: { data: { stringValue: data } } } });
}
rmSync(tmp, { recursive: true, force: true });

if (unknown.length) console.log(`Skipped (no player with that id): ${unknown.join(', ')}`);
const missing = [...ids].filter((id) => !writes.some((w) => w.update.name.endsWith(`/${id}`)));
if (missing.length) console.log(`No photo for: ${missing.join(', ')}`);
await commit(writes);
console.log(`Uploaded ${writes.length} photos`);
