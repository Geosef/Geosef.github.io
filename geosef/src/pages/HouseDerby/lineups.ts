// Lineups, Ryder Cup style: before each announcement, each team's managers
// order their players into numbered slots without seeing the other side's,
// and slot N plays slot N. One announcement can cover several stages (both
// Friday alt-shot stages are announced Thursday night), so a group's slots
// run on across them: Friday's slots 1-3 are Alt-Shot 1, 4-6 Alt-Shot 2.
import type { Match, Session } from './data';
import type { TeamId } from './scoring';

/** A team's draft: group slot number ("1", "2", ...) -> player ids ('' = not picked yet). */
export type Slots = Record<string, string[]>;

export interface GroupSlot {
  /** 1-based across the whole group. */
  n: number;
  session: Session;
  /** The match slot within its stage. */
  slot: number;
}

/** Players per side in a stage's matches. */
export function perSide(session: Session): number {
  return session.format === 'singles' ? 1 : 2;
}

/** Announcement groups in play order. */
export function groupIds(sessions: Session[]): string[] {
  return [...new Set([...sessions].sort((a, b) => a.order - b.order).map(s => s.group))];
}

/** The group's stages in play order. */
export function groupSessions(sessions: Session[], group: string): Session[] {
  return sessions.filter(s => s.group === group).sort((a, b) => a.order - b.order);
}

/** Every slot a team fills for the group, numbered across its stages. */
export function groupSlots(sessions: Session[], group: string): GroupSlot[] {
  let n = 0;
  return groupSessions(sessions, group).flatMap(session =>
    Array.from({ length: session.pairings }, (_, i) => ({ n: ++n, session, slot: i + 1 })));
}

/** The players picked for a slot, without blanks. */
export function picked(slots: Slots | undefined, n: number): string[] {
  return (slots?.[n] ?? []).filter(Boolean);
}

/** What stops a lineup from being locked, in slot order. Empty when it's ready. */
export function lineupProblems(slots: Slots | undefined, layout: GroupSlot[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, number>();
  for (const s of layout) {
    const ids = picked(slots, s.n);
    const need = perSide(s.session);
    if (ids.length < need) problems.push(`Slot ${s.n} needs ${need - ids.length} more`);
    for (const id of ids) {
      const first = seen.get(id);
      if (first !== undefined) problems.push(`Slot ${s.n} repeats a player from slot ${first}`);
      else seen.set(id, s.n);
    }
  }
  return problems;
}

/** Group slot -> the match ids it fills (an indoor pairing's front and back nine). */
function slotMatches(layout: GroupSlot[], matches: Match[]): Map<number, Match[]> {
  return new Map(layout.map(s => [s.n, matches.filter(m => m.session === s.session.id && m.slot === s.slot)]));
}

/** The players to write onto each match when the group is announced. */
export function announcement(layout: GroupSlot[], matches: Match[], lineups: Record<TeamId, Slots | undefined>) {
  const bySlot = slotMatches(layout, matches);
  return layout.flatMap(s => (bySlot.get(s.n) ?? []).map(m => ({
    matchId: m.id,
    players: { og: picked(lineups.og, s.n), south: picked(lineups.south, s.n) },
  })));
}

/** Whether a group's matches are on the board yet (every match has both sides). */
export function isAnnounced(matches: Match[]): boolean {
  return matches.length > 0 && matches.every(m => m.players.og.length && m.players.south.length);
}
