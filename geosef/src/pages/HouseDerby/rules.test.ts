// firestore.rules against the emulator: `npm run test:rules` (needs Java).
// Skipped by plain `npm test`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const SUPER = 'super@example.com';
const ADMIN = 'admin@example.com';
const MARSHAL = 'marshal@example.com';
const OG = 'og.manager@example.com';
const SOUTH = 'south.manager@example.com';
const NOBODY = 'fan@example.com';

let env: RulesTestEnvironment;
const as = (email: string) => env.authenticatedContext(email, { email, email_verified: true }).firestore();

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('firestore.rules', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-house-derby-rules',
      firestore: { rules: readFileSync(resolve(process.cwd(), '../firestore.rules'), 'utf8') },
    });
  });
  afterAll(() => env?.cleanup());

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'roles', SUPER), { superAdmin: true });
      await setDoc(doc(db, 'roles', ADMIN), { admin: true });
      await setDoc(doc(db, 'roles', MARSHAL), { marshal: true });
      await setDoc(doc(db, 'roles', OG), { team: 'og' });
      await setDoc(doc(db, 'roles', SOUTH), { team: 'south' });
      for (let i = 1; i <= 12; i++) {
        await setDoc(doc(db, 'matches', `sat-pm-${i}`), { session: 'sat-pm', slot: i, players: { og: [], south: [] }, holes: {} });
      }
    });
  });

  const lock = (email: string, team: string, value = true) =>
    setDoc(doc(as(email), 'groups', 'sat-pm'), { locked: { [team]: value } }, { merge: true });
  const draft = (email: string, team: string) =>
    setDoc(doc(as(email), 'lineups', `sat-pm_${team}`), { group: 'sat-pm', team, slots: { 1: ['a'] } }, { merge: true });

  it('lets each user read only their own role', async () => {
    await assertSucceeds(getDoc(doc(as(OG), 'roles', OG)));
    await assertFails(getDoc(doc(as(OG), 'roles', SOUTH)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'roles', OG)));
  });

  it('matches role docs case-insensitively', async () => {
    const mixed = 'OG.Manager@Example.com';
    await assertSucceeds(setDoc(doc(as(mixed), 'lineups', 'sat-pm_og'), { group: 'sat-pm', team: 'og', slots: {} }));
  });

  it('keeps drafts blind until both teams lock', async () => {
    await assertSucceeds(draft(OG, 'og'));
    await assertSucceeds(draft(SOUTH, 'south'));
    // Watching your own draft works before it exists.
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'roles', OG), { team: 'og' }));
    await assertSucceeds(getDoc(doc(as(OG), 'lineups', 'sat-pm_og')));
  });

  it('hides the other team and admins from a draft until both lock, then reveals it', async () => {
    await draft(OG, 'og');
    await draft(SOUTH, 'south');
    await assertFails(draft(SOUTH, 'og'));
    await assertFails(getDoc(doc(as(SOUTH), 'lineups', 'sat-pm_og')));
    await assertFails(getDoc(doc(as(ADMIN), 'lineups', 'sat-pm_og')));
    await assertFails(getDoc(doc(as(NOBODY), 'lineups', 'sat-pm_og')));
    await assertSucceeds(lock(OG, 'og'));
    await assertFails(getDoc(doc(as(SOUTH), 'lineups', 'sat-pm_og')));
    await assertSucceeds(lock(SOUTH, 'south'));
    await assertSucceeds(getDoc(doc(as(SOUTH), 'lineups', 'sat-pm_og')));
    await assertSucceeds(getDoc(doc(as(ADMIN), 'lineups', 'sat-pm_og')));
    await assertFails(getDoc(doc(as(NOBODY), 'lineups', 'sat-pm_og')));
  });

  it('freezes a locked draft, and only allows unlocking before the other side locks', async () => {
    await draft(OG, 'og');
    await lock(OG, 'og');
    await assertFails(draft(OG, 'og'));
    await assertSucceeds(lock(OG, 'og', false));
    await assertSucceeds(draft(OG, 'og'));
    await lock(OG, 'og');
    await assertFails(lock(SOUTH, 'og', false));
    await assertSucceeds(lock(SOUTH, 'south'));
    await assertFails(lock(OG, 'og', false));
  });

  it('lets only admins announce, in one batch across every match', async () => {
    await lock(OG, 'og');
    await lock(SOUTH, 'south');
    const announce = (email: string) => {
      const db = as(email);
      const batch = writeBatch(db);
      for (let i = 1; i <= 12; i++) batch.update(doc(db, 'matches', `sat-pm-${i}`), { players: { og: ['a'], south: ['b'] } });
      batch.update(doc(db, 'groups', 'sat-pm'), { announced: true, announcedBy: email });
      return batch.commit();
    };
    await assertFails(announce(OG));
    await assertFails(announce(MARSHAL));
    await assertSucceeds(announce(ADMIN));
    // Announced: drafts and locks are frozen for managers.
    await assertFails(lock(OG, 'og', false));
  });

  it('keeps scorers to scoring fields', async () => {
    const db = as(MARSHAL);
    await assertSucceeds(updateDoc(doc(db, 'matches', 'sat-pm-1'), { 'holes.1': { result: 'og' } }));
    await assertFails(updateDoc(doc(db, 'matches', 'sat-pm-1'), { players: { og: ['x'], south: [] } }));
    // Managers and super admins score too; signed-in strangers don't.
    await assertSucceeds(updateDoc(doc(as(OG), 'matches', 'sat-pm-1'), { 'holes.2': { result: 'og' } }));
    await assertSucceeds(updateDoc(doc(as(SUPER), 'matches', 'sat-pm-1'), { 'holes.3': { result: 'og' } }));
    await assertFails(updateDoc(doc(as(NOBODY), 'matches', 'sat-pm-1'), { 'holes.4': { result: 'og' } }));
  });

  it('lets only super admins see and manage staff', async () => {
    await assertSucceeds(getDocs(collection(as(SUPER), 'roles')));
    await assertFails(getDocs(collection(as(ADMIN), 'roles')));
    await assertFails(getDoc(doc(as(ADMIN), 'roles', OG)));
    await assertFails(setDoc(doc(as(ADMIN), 'roles', NOBODY), { marshal: true }));
    await assertSucceeds(setDoc(doc(as(SUPER), 'roles', NOBODY), { marshal: true, team: 'south' }));
    await assertSucceeds(updateDoc(doc(as(NOBODY), 'matches', 'sat-pm-1'), { 'holes.5': { result: 'og' } }));
    await assertFails(setDoc(doc(as(SUPER), 'roles', 'Mixed@Example.com'), { marshal: true }));
    await assertFails(setDoc(doc(as(SUPER), 'roles', NOBODY), { team: 'both' }));
    await assertFails(setDoc(doc(as(SUPER), 'roles', NOBODY), { owner: true }));
    await assertSucceeds(deleteDoc(doc(as(SUPER), 'roles', NOBODY)));
    // Never locks themselves out.
    await assertFails(setDoc(doc(as(SUPER), 'roles', SUPER), { admin: true }));
    await assertFails(deleteDoc(doc(as(SUPER), 'roles', SUPER)));
  });

  it('lets only super admins reset everything', async () => {
    await draft(OG, 'og');
    await lock(OG, 'og');
    await setDoc(doc(as(MARSHAL), 'matches', 'sat-pm-1', 'edits', 'e1'), { by: MARSHAL });
    const reset = (email: string) => {
      const db = as(email);
      const batch = writeBatch(db);
      batch.delete(doc(db, 'matches', 'sat-pm-1', 'edits', 'e1'));
      batch.delete(doc(db, 'lineups', 'sat-pm_og'));
      batch.delete(doc(db, 'groups', 'sat-pm'));
      batch.update(doc(db, 'matches', 'sat-pm-1'), { holes: {}, concededBy: null, players: { og: [], south: [] } });
      return batch.commit();
    };
    await assertFails(reset(ADMIN));
    await assertSucceeds(reset(SUPER));
    // Deleting drafts never meant being able to read them.
    await assertFails(getDoc(doc(as(SUPER), 'lineups', 'sat-pm_south')));
  });

  it('lets only admins flip the board live', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'event', 'status')));
    await assertFails(setDoc(doc(as(OG), 'event', 'status'), { live: true }));
    await assertSucceeds(setDoc(doc(as(ADMIN), 'event', 'status'), { live: true, updatedBy: ADMIN }));
  });
});
