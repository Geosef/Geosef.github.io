// Super admins' testing tools: random matchups so demo scores show on the
// board, and Reset everything to get back to a clean slate before the first
// real lineups. Rules allow these to super admins only.
import { collection, doc, getDocs, writeBatch, type DocumentReference } from 'firebase/firestore';
import { db } from './firebase';
import { groupIds, perSide } from './lineups';
import { TEAMS, type TeamId } from './scoring';
import type { Match, Player, Session } from './data';

type Write = (batch: ReturnType<typeof writeBatch>) => void;

/** Firestore caps a batch at 500 writes. */
async function commitAll(writes: Write[]) {
  for (let i = 0; i < writes.length; i += 450) {
    const batch = writeBatch(db);
    writes.slice(i, i + 450).forEach(w => w(batch));
    await batch.commit();
  }
}

const shuffle = <T,>(xs: T[]) => xs.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

/**
 * Random players on every match, each player once per stage (both nines of
 * an indoor pairing get the same players). Doesn't touch lineups or locks.
 */
export function randomMatchups(sessions: Session[], matches: Match[], players: Player[]) {
  const writes: Write[] = [];
  for (const s of sessions) {
    const picks = Object.fromEntries(TEAMS.map(t => [t, shuffle(players.filter(p => p.team === t).map(p => p.id))])) as Record<TeamId, string[]>;
    const n = perSide(s);
    for (const m of matches.filter(x => x.session === s.id)) {
      const at = (m.slot - 1) * n;
      const ref = doc(db, 'matches', m.id);
      writes.push(b => b.update(ref, { players: { og: picks.og.slice(at, at + n), south: picks.south.slice(at, at + n) } }));
    }
  }
  return commitAll(writes);
}

/**
 * Back to before the first lineup: clears every score, concession, edit log,
 * announced player, lineup draft and lock, and puts the public board back on
 * the countdown. Staff roles are kept. Same as the seed's --reset-scores.
 */
export async function resetEverything(sessions: Session[], matches: Match[], email: string) {
  const deletes: DocumentReference[] = [];
  for (const m of matches) {
    const edits = await getDocs(collection(db, 'matches', m.id, 'edits'));
    deletes.push(...edits.docs.map(d => d.ref));
  }
  // Drafts are deleted by id, never read: they may still be blind.
  for (const g of groupIds(sessions)) {
    for (const t of TEAMS) deletes.push(doc(db, 'lineups', `${g}_${t}`));
    deletes.push(doc(db, 'groups', g));
  }
  await commitAll([
    ...deletes.map(ref => (b: ReturnType<typeof writeBatch>) => b.delete(ref)),
    ...matches.map(m => (b: ReturnType<typeof writeBatch>) => b.update(doc(db, 'matches', m.id), {
      holes: {}, concededBy: null, players: { og: [], south: [] }, updatedBy: `${email} (reset)`,
    })),
    b => b.set(doc(db, 'event', 'status'), { live: false, updatedBy: email }),
  ]);
}
