import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import { holeOutcome, matchStates, segments, type MatchScoring, type MatchState, type TeamId } from './scoring';

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
  /** Holes per match (every match is a nine). */
  holes: 9;
  /** Indoor pairings play a front and a back nine as separate matches. */
  nines?: Array<'front' | 'back'>;
  /** Town shown under the venue on the TV boards. */
  location?: string;
  /** Overrides the format's display name (e.g. "Indoor Alt-Shot"). */
  formatLabel?: string;
  /** First tee time, ISO with offset ("2026-10-16T17:00:00-05:00"). */
  startsAt?: string;
  /** Minutes between slots' tee times (outdoor). */
  teeInterval?: number;
  /** When indoor back nines start. */
  backNineAt?: string;
  note?: string;
}

export interface Match extends MatchScoring {
  id: string;
  session: string;
  slot: number;
  /** Which nine of an indoor pairing this match is. */
  nine?: 'front' | 'back';
  players: Record<TeamId, string[]>;
  /** When a score was last entered (ms). */
  updatedAt?: number;
  /** Scheduled tee time, ISO with offset (seeded from the session's schedule). */
  teeTime?: string | null;
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

/**
 * Player portraits (player id -> image data URL), from cup-seed/photos.mjs.
 * Only the views that show portraits subscribe, so the phone board never
 * downloads them.
 */
export function usePhotos(): Map<string, string> {
  const { items } = useCollection<{ id: string; data: string }>('photos', (id, d) => ({ id, data: String(d.data ?? '') }));
  return new Map((items ?? []).filter(p => p.data).map(p => [p.id, p.data]));
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
    // Firestore Timestamp -> ms; null while a server timestamp is pending.
    updatedAt: (d.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.(),
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

const NINE_ORDER = { front: 0, back: 1 };

/** Sort key: session order, then slot, then front nine before back. */
export function matchSort(sessions: Session[]) {
  const order = new Map(sessions.map(s => [s.id, s.order]));
  return (a: Match, b: Match) =>
    (order.get(a.session) ?? 0) - (order.get(b.session) ?? 0)
    || a.slot - b.slot
    || NINE_ORDER[a.nine ?? 'front'] - NINE_ORDER[b.nine ?? 'front'];
}

/** "Front" / "Back" for indoor nines, else empty. */
export function nineName(match: { nine?: 'front' | 'back' }): string {
  return match.nine ? (match.nine === 'front' ? 'Front' : 'Back') : '';
}

/**
 * "Match 3", or "Match 3 · Back" for an indoor nine. Marshal screens only:
 * viewers know a match by who's in it (each player plays once per stage).
 */
export function matchName(match: { slot: number; nine?: 'front' | 'back' }): string {
  return match.nine ? `Match ${match.slot} · ${nineName(match)}` : `Match ${match.slot}`;
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

// Tee times are the event's local time wherever the board is watched.
const EVENT_TZ = 'America/Chicago';

/** "5:45 PM" in the event's time zone. */
export function teeClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: EVENT_TZ });
}

/** "Fri, Oct 16 · 5:00 PM" in the event's time zone. */
export function teeDay(iso: string): string {
  const day = new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: EVENT_TZ });
  return `${day} · ${teeClock(iso)}`;
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

/** Broadcast-style status: "2UP", "3&2", "1UP", "TIED", "HALVED". */
export function shortLabel(state: MatchState): string {
  if (state.phase === 'not-started') return '';
  if (state.concededBy) return 'CONC';
  if (state.phase === 'final') return state.winner ? state.label.replace(' ', '') : 'HALVED';
  if (!state.leader) return 'TIED';
  return `${state.up}UP`;
}

/** Short status across a match's nines: "3&2", or "F 2&1 · B 1UP" for 18 holes. */
export function shortStatus(states: MatchState[]): string {
  if (states.length === 1) return shortLabel(states[0]);
  return states
    .map((s, i) => (s.phase === 'not-started' ? '' : `${i === 0 ? 'F' : 'B'} ${shortLabel(s)}`))
    .filter(Boolean)
    .join(' · ');
}

/**
 * Who the match is "showing" for: the leader of the nine in play, else the
 * winner of the latest decided nine. Null when level or not started.
 */
export function matchLead(states: MatchState[]): { lead: TeamId | null; started: boolean } {
  const current = states.find(s => s.phase === 'live')
    ?? [...states].reverse().find(s => s.phase === 'final')
    ?? states[0];
  return {
    lead: current.phase === 'final' ? current.winner : current.leader,
    started: states.some(s => s.phase !== 'not-started'),
  };
}

/**
 * Broadcast "thru" column: F when every nine is decided, – before the first
 * hole, otherwise the last hole played in play order (1-18 for indoor).
 */
export function thruLabel(match: MatchScoring): string {
  const states = matchStates(match);
  if (states.every(s => s.phase === 'final')) return 'F';
  const order = segments(match).flat();
  let last: number | null = null;
  for (const h of order) if (holeOutcome(match, h)) last = h;
  return last === null ? '–' : String(last);
}

/**
 * The stage being played now. Sessions run one at a time in order, so it's
 * the first with an unfinished match; once everything is final, the last.
 */
export function activeSessionId(sessions: Session[], matches: Match[]): string | undefined {
  const open = sessions.find(s => matches.some(m => m.session === s.id && matchStates(m).some(st => st.phase !== 'final')));
  return (open ?? sessions[sessions.length - 1])?.id;
}

/** Display name for a session's format ("Indoor Alt-Shot", "Scramble"). */
export function formatLabel(session: Session): string {
  return session.formatLabel ?? FORMAT_NAMES[session.format] ?? session.format;
}

/** "Friday · Alt-Shot 1", or just "Saturday" when the name repeats the format. */
export function dayAndSession(session: Session): string {
  const day = session.day === 'fri' ? 'Friday' : 'Saturday';
  return session.name === formatLabel(session) ? day : `${day} · ${session.name}`;
}
