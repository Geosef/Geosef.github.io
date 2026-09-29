import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import { matchStates, type MatchScoring, type MatchState, type TeamId } from './scoring';

export interface Player {
  id: string;
  first: string;
  last: string;
  team: TeamId;
  captain: boolean;
}

export interface Session {
  id: string;
  day: 'fri' | 'sat';
  order: number;
  name: string;
  venue: string;
  format: string;
  holes: 9 | 18;
  note?: string;
}

export interface Match extends MatchScoring {
  id: string;
  session: string;
  slot: number;
  players: Record<TeamId, string[]>;
  /** True while this client has writes not yet confirmed by the server. */
  pending: boolean;
}

export const TEAM_NAMES: Record<TeamId, string> = { og: 'OG House', south: 'South House' };

export const FORMAT_NAMES: Record<string, string> = {
  'alt-shot': 'Alternate Shot',
  scramble: 'Scramble',
  'modified-alt': 'Modified Alt',
  singles: 'Singles',
};

function useCollection<T>(path: string, map: (id: string, data: Record<string, unknown>, pending: boolean) => T, order?: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const ref = collection(db, path);
    return onSnapshot(
      order ? query(ref, orderBy(order)) : ref,
      { includeMetadataChanges: true },
      snap => setItems(snap.docs.map(d => map(d.id, d.data(), d.metadata.hasPendingWrites))),
      e => setError(e.message),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, order]);
  return { items, error };
}

export function usePlayers() {
  const { items, error } = useCollection<Player>('players', (id, d) => ({ id, ...d } as Player));
  const byId = new Map((items ?? []).map(p => [p.id, p]));
  return { players: items, byId, error };
}

export function useSessions() {
  const { items, error } = useCollection<Session>('sessions', (id, d) => ({ id, ...d } as Session), 'order');
  return { sessions: items, error };
}

function toMatch(id: string, d: Record<string, unknown>, pending: boolean): Match {
  return {
    holes: {},
    strokes: { og: [], south: [] },
    players: { og: [], south: [] },
    ...d,
    id,
    pending,
  } as unknown as Match;
}

export function useMatches() {
  const { items, error } = useCollection<Match>('matches', toMatch);
  return { matches: items, error };
}

export function useMatch(id: string) {
  const [match, setMatch] = useState<Match | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onSnapshot(
    doc(db, 'matches', id),
    { includeMetadataChanges: true },
    snap => setMatch(snap.exists() ? toMatch(snap.id, snap.data(), snap.metadata.hasPendingWrites) : null),
    e => setError(e.message),
  ), [id]);
  return { match, error };
}

/** "Smith / Jones", or "TBD" before pairings are set. */
export function sideName(match: Match, team: TeamId, byId: Map<string, Player>): string {
  const ids = match.players[team];
  if (!ids.length) return 'TBD';
  return ids.map(id => byId.get(id)?.last ?? id).join(' / ');
}

/** Sort key: session order, then slot. */
export function matchSort(sessions: Session[]) {
  const order = new Map(sessions.map(s => [s.id, s.order]));
  return (a: Match, b: Match) =>
    (order.get(a.session) ?? 0) - (order.get(b.session) ?? 0) || a.slot - b.slot;
}

/** Status line for a match: one label per nine ("F 2&1 · B 1 UP thru 3"). */
export function statusLabel(states: MatchState[]): string {
  if (states.length === 1) return states[0].label;
  return states.map((s, i) => `${i === 0 ? 'F' : 'B'} ${s.label}`).join(' · ');
}

/** "Sam Smith & Alex Jones" for the match detail header. */
export function sideFullName(match: Match, team: TeamId, byId: Map<string, Player>): string {
  const ids = match.players[team];
  if (!ids.length) return 'TBD';
  return ids.map(id => {
    const p = byId.get(id);
    return p ? `${p.first} ${p.last}` : id;
  }).join(' & ');
}

/** Points with a ½ glyph: 7.5 -> "7½", 0.5 -> "½". */
export function fmtPoints(n: number): string {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  if (!half) return String(whole);
  return whole === 0 ? '½' : `${whole}½`;
}

/**
 * The session to show first: one with a live match, else the latest that has
 * any result, else the first.
 */
export function currentSessionId(sessions: Session[], matches: Match[]): string | undefined {
  const phases = (id: string) => matches.filter(m => m.session === id).flatMap(m => matchStates(m).map(s => s.phase));
  const live = sessions.find(s => phases(s.id).includes('live'));
  if (live) return live.id;
  const started = [...sessions].reverse().find(s => phases(s.id).some(p => p !== 'not-started'));
  return (started ?? sessions[0])?.id;
}
