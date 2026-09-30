import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { HoleEntry, TeamId } from './scoring';

// Each change updates the match and appends to its edit log in one batch, so
// "who changed hole 6?" always has an answer. The returned promise only
// settles once the server acknowledges, which can be much later when a
// marshal is offline; callers shouldn't block the UI on it, only surface
// rejections (e.g. the rules deny a non-marshal).
function commit(matchId: string, email: string, fields: Record<string, unknown>, log: Record<string, unknown>) {
  const batch = writeBatch(db);
  const ref = doc(db, 'matches', matchId);
  batch.update(ref, { ...fields, updatedAt: serverTimestamp(), updatedBy: email });
  batch.set(doc(collection(ref, 'edits')), { ...log, by: email, at: serverTimestamp() });
  return batch.commit();
}

export function saveHole(matchId: string, email: string, hole: number, before: HoleEntry | undefined, after: HoleEntry) {
  return commit(matchId, email, { [`holes.${hole}`]: after }, { hole, before: before ?? null, after });
}

export function setConcession(matchId: string, email: string, concededBy: TeamId | null) {
  return commit(matchId, email, { concededBy }, { concededBy });
}
