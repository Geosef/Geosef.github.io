// Signed-in staff (marshals, team managers, admins) and the documents only
// they write: lineup drafts, locks, announcements and the live switch. What
// each role may do is enforced by firestore.rules; this only decides what
// the app offers.
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import type { Slots } from './lineups';
import type { TeamId } from './scoring';
import { TEAM_NAMES } from './data';

export interface Role {
  /** An admin who can also add, edit and remove staff. */
  superAdmin?: boolean;
  admin?: boolean;
  marshal?: boolean;
  /** The team this person manages lineups for. */
  team?: TeamId;
}

/** "Super admin · OG House manager". */
export function roleLabel(role: Role): string {
  const parts = [
    role.superAdmin ? 'Super admin' : role.admin && 'Admin',
    role.team && `${TEAM_NAMES[role.team]} manager`,
    role.marshal && !isAdmin(role) && 'Marshal',
  ].filter(Boolean);
  return parts.join(' · ') || 'No role';
}

export const isAdmin = (r: Role) => !!(r.admin || r.superAdmin);
/** Who can enter scores: marshals, managers and admins. */
export const canScore = (r: Role) => !!(isAdmin(r) || r.marshal || r.team);

// Staff sign in with Firebase's own Google popup rather than the site's One
// Tap flow: One Tap is often suppressed on iOS Safari, and Firebase keeps its
// session alive across the round without the ~1h Google token expiry.
export function useStaff() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  // undefined while loading; {} for a signed-in user with no role.
  const [role, setRole] = useState<Role | undefined>();

  useEffect(() => onAuthStateChanged(auth, u => {
    setUser(u);
    setReady(true);
  }), []);

  const email = user?.email?.toLowerCase();
  useEffect(() => {
    setRole(undefined);
    if (!email) return;
    return onSnapshot(doc(db, 'roles', email), s => setRole((s.data() as Role | undefined) ?? {}), () => setRole({}));
  }, [email]);

  return {
    user,
    role,
    ready: ready && (!user || role !== undefined),
    signIn: () => signInWithPopup(auth, googleProvider),
    signOut: () => signOut(auth),
  };
}

/** Whether the public board is up (else viewers get the countdown). undefined while loading. */
export function useLive(): boolean | undefined {
  const [live, setLive] = useState<boolean | undefined>();
  useEffect(() => {
    // The offline cache can hold a stale "not live" from before go-live, which
    // would flash the countdown. Trust a cached "not live" only if the server
    // hasn't answered in a few seconds (an offline device).
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const stop = onSnapshot(doc(db, 'event', 'status'), { includeMetadataChanges: true }, s => {
      const value = s.data()?.live === true;
      clearTimeout(fallback);
      if (value || !s.metadata.fromCache) setLive(value);
      else fallback = setTimeout(() => setLive(v => v ?? value), 4000);
    }, () => setLive(false));
    return () => { clearTimeout(fallback); stop(); };
  }, []);
  return live;
}

export function setLive(live: boolean, email: string) {
  return setDoc(doc(db, 'event', 'status'), { live, updatedBy: email });
}

export interface GroupState {
  locked: Partial<Record<TeamId, boolean>>;
  announced: boolean;
  announcedAt?: number;
}

/** Lock and announce state of every announcement group (public). */
export function useGroups(): Map<string, GroupState> | null {
  const [groups, setGroups] = useState<Map<string, GroupState> | null>(null);
  useEffect(() => onSnapshot(collection(db, 'groups'), snap => setGroups(new Map(snap.docs.map(d => {
    const data = d.data();
    return [d.id, {
      locked: data.locked ?? {},
      announced: data.announced === true,
      announcedAt: data.announcedAt?.toMillis?.(),
    }];
  })))), []);
  return groups;
}

export const bothLocked = (g: GroupState | undefined) => !!(g?.locked.og && g.locked.south);

/**
 * A team's draft for a group. Only listened to when the rules allow it (your
 * own team, or either once both have locked): a denied listener stops for good.
 */
export function useLineup(group: string, team: TeamId, allowed: boolean) {
  const [state, setState] = useState<{
    slots?: Slots; pending: boolean; loaded: boolean;
    /** Confirmed by the server rather than read from the offline cache. */
    fresh: boolean;
    error?: string;
  }>({ pending: false, loaded: false, fresh: false });
  useEffect(() => {
    // Reset, so switching groups never shows the last group's slots.
    setState({ pending: false, loaded: false, fresh: false });
    if (!allowed) return;
    return onSnapshot(
      doc(db, 'lineups', `${group}_${team}`),
      { includeMetadataChanges: true },
      s => setState({ slots: s.data()?.slots ?? {}, pending: s.metadata.hasPendingWrites, loaded: true, fresh: !s.metadata.fromCache }),
      e => setState({ pending: false, loaded: true, fresh: false, error: e.message }),
    );
  }, [group, team, allowed]);
  return state;
}

/**
 * Saves one slot. Each slot is its own field, so two managers editing
 * different slots at once don't overwrite each other.
 */
export function saveSlot(group: string, team: TeamId, n: number, ids: string[], email: string) {
  return setDoc(
    doc(db, 'lineups', `${group}_${team}`),
    { group, team, slots: { [n]: ids }, updatedAt: serverTimestamp(), updatedBy: email },
    { merge: true },
  );
}

export function setLocked(group: string, team: TeamId, locked: boolean) {
  return setDoc(doc(db, 'groups', group), { locked: { [team]: locked } }, { merge: true });
}

/**
 * Puts both lineups on the board in one batch. Resolves only once the server
 * has it, so "Announced" is never shown for a write still queued offline.
 */
export function announce(group: string, writes: Array<{ matchId: string; players: Record<TeamId, string[]> }>, email: string) {
  const batch = writeBatch(db);
  for (const w of writes) batch.update(doc(db, 'matches', w.matchId), { players: w.players });
  batch.set(doc(db, 'groups', group), { announced: true, announcedAt: serverTimestamp(), announcedBy: email }, { merge: true });
  return batch.commit();
}

/**
 * Unlocks both teams so lineups can change. The board keeps the announced
 * players until the group is announced again.
 */
export function reopen(group: string, email: string) {
  return setDoc(doc(db, 'groups', group), { locked: { og: false, south: false }, announced: false, announcedBy: email }, { merge: true });
}

/** Every staff role doc (super admins only; the rules deny anyone else). */
export function useStaffList() {
  const [staff, setStaff] = useState<Array<Role & { email: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onSnapshot(
    collection(db, 'roles'),
    snap => setStaff(snap.docs.map(d => ({ email: d.id, ...(d.data() as Role) })).sort((a, b) => a.email.localeCompare(b.email))),
    e => setError(e.message),
  ), []);
  return { staff, error };
}

/** Replaces someone's role (only the flags that are on are stored). */
export function saveRole(email: string, role: Role, by: string) {
  const data: Record<string, unknown> = { updatedBy: by };
  if (role.superAdmin) data.superAdmin = true;
  if (role.admin) data.admin = true;
  if (role.marshal) data.marshal = true;
  if (role.team) data.team = role.team;
  return setDoc(doc(db, 'roles', email.trim().toLowerCase()), data);
}

export function removeRole(email: string) {
  return deleteDoc(doc(db, 'roles', email));
}
