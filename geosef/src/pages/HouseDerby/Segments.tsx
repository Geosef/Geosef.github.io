import React, { useEffect, useState } from 'react';
import {
  TEAM_NAMES, dayAndSession, fmtPoints, formatLabel, matchName, shortStatus, sideName, teeClock, teeDay, type Match, type Player, type Session,
} from './data';
import { BOARD, decided, playlist, segmentAt, segmentKey, toPlay, type Segment, type SegmentKind } from './director';
import { TEAMS, cupStanding, matchStates, type TeamId } from './scoring';
import Logo from './Logo';

/**
 * The segment the TV boards show now. `pinned` (from ?scene=) holds one
 * segment regardless; otherwise `hold` keeps the live board up while a score
 * moment plays on it.
 */
export function useSegment(sessions: Session[], matches: Match[], pinned: SegmentKind | null, hold: boolean): Segment {
  const [now, setNow] = useState(() => Date.now());
  const list = playlist(sessions, matches);
  const { segment, endsIn } = segmentAt(list, now);
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), endsIn + 50);
    return () => clearTimeout(t);
  }, [now, endsIn]);
  if (pinned) return playlist(sessions, matches, true).find(s => s.kind === pinned) ?? BOARD;
  if (hold) return BOARD;
  return segment;
}

const SWAP_MS = 420;

/**
 * Plays the team-color wipe when the segment changes and swaps content while
 * the wipe covers the screen, so the old and new never show half-drawn.
 */
export function useWipe(segment: Segment): { shown: Segment; wipe: number } {
  const key = segmentKey(segment);
  const [shown, setShown] = useState(segment);
  const [wipe, setWipe] = useState(0);
  useEffect(() => {
    if (key === segmentKey(shown)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(segment);
      return;
    }
    setWipe(w => w + 1);
    const t = setTimeout(() => setShown(segment), SWAP_MS);
    return () => clearTimeout(t);
    // Keyed on the segment's identity; `segment` itself is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { shown: key === segmentKey(shown) ? segment : shown, wipe };
}

/** Navy then green panels sweeping across the board body. */
export function Wipe({ n }: { n: number }) {
  if (!n) return null;
  return (
    <div key={n} className="hd-wipe" aria-hidden>
      <span className="og" />
      <span className="south" />
      <Logo name="crest" className="hd-wipe-crest" />
    </div>
  );
}

/** The recap of a stage: points each house took, then every result. */
export function RecapView({ session, matches, byId }: { session: Session; matches: Match[]; byId: Map<string, Player> }) {
  const inSession = matches.filter(m => m.session === session.id);
  const { points } = cupStanding(inSession);
  const done = decided(matches, session.id).sort((a, b) => a.slot - b.slot || (a.nine === 'back' ? 1 : 0) - (b.nine === 'back' ? 1 : 0));
  const partial = done.length < inSession.length;
  return (
    <div className="hd-seg hd-recap">
      <div className="hd-seg-title">
        <span>{dayAndSession(session)}</span>
        <span className="hd-seg-kicker">{partial ? 'Results so far' : 'Results'}</span>
      </div>
      <div className="hd-recap-score">
        {TEAMS.map(t => (
          <div key={t} className={`hd-recap-team ${t}`}>
            <Logo name={t} className="hd-recap-logo" />
            <span className="hd-recap-name">{TEAM_NAMES[t]}</span>
            <span className="hd-recap-pts">{fmtPoints(points[t])}</span>
          </div>
        ))}
      </div>
      <div className="hd-recap-list" style={{ ['--rows' as string]: Math.ceil(done.length / 2) }}>
        {done.map(m => {
          const states = matchStates(m);
          const winner = states[0].winner;
          return (
            <div key={m.id} className={`hd-recap-item ${winner ?? 'halved'}`}>
              <span className="hd-recap-slot">{matchName(m)}</span>
              <span className="hd-recap-who">{winner ? sideName(m, winner, byId) : 'Halved'}</span>
              <span className="hd-recap-margin">{shortStatus(states)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A player's placeholder portrait: initials on the team color. Photos slot in here later. */
function Portrait({ player, team }: { player?: Player; team: TeamId }) {
  const initials = player ? `${player.first[0] ?? ''}${player.last[0] ?? ''}` : '?';
  return <span className={`hd-portrait ${team}`}>{initials}</span>;
}

function CardSide({ ids, team, byId }: { ids: string[]; team: TeamId; byId: Map<string, Player> }) {
  if (!ids.length) return <div className={`hd-card-side ${team}`}><span className="hd-card-tbd">TBD</span></div>;
  return (
    <div className={`hd-card-side ${team}`}>
      {ids.map(id => {
        const p = byId.get(id);
        return (
          <div key={id} className="hd-card-player">
            <Portrait player={p} team={team} />
            <span className="hd-card-name">
              <span className="hd-card-first">{p?.first}</span>
              <span className="hd-card-last">{p?.last ?? id}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Pairings still to tee off in a stage, one card per pairing. */
export function NextView({ session, matches, byId, vertical }: {
  session: Session; matches: Match[]; byId: Map<string, Player>; vertical: boolean;
}) {
  const left = toPlay(matches, session.id);
  // Indoor pairings are two matches (front and back nine) with the same players.
  const bySlot = new Map<number, Match[]>();
  for (const m of left) bySlot.set(m.slot, [...(bySlot.get(m.slot) ?? []), m].sort((a, b) => (a.nine === 'back' ? 1 : 0) - (b.nine === 'back' ? 1 : 0)));
  const cards = [...bySlot.entries()].sort(([a], [b]) => a - b);
  const started = matches.some(m => m.session === session.id && !left.includes(m));
  // Count down to the next match still to tee off (the session start if unscheduled).
  const nextTee = left.map(m => m.teeTime).filter((t): t is string => !!t).sort()[0] ?? session.startsAt;
  const n = cards.length;
  const cols = vertical ? (n <= 3 ? 1 : 2) : n <= 3 ? 3 : n <= 6 ? 3 : 4;
  return (
    <div className="hd-seg hd-next">
      <div className="hd-seg-title">
        <span>{started ? 'Still to play' : 'Up next'} · {dayAndSession(session)}</span>
        <span className="hd-seg-kicker">
          {formatLabel(session)}
          {nextTee && <Countdown at={nextTee} />}
        </span>
      </div>
      <div className="hd-next-grid" style={{ ['--cols' as string]: cols, ['--rows' as string]: Math.ceil(n / cols) }}>
        {cards.map(([slot, ms]) => {
          // Both nines left: "F9 6:30 · B9 7:15 PM". One: its name in the tag, one time.
          const both = ms.length === 2;
          const tag = both ? '' : ms[0].nine === 'back' ? 'Back 9' : ms[0].nine === 'front' ? 'Front 9' : '';
          const tees = both
            ? ms.map((m, i) => m.teeTime && `${m.nine === 'back' ? 'B9' : 'F9'} ${i === 0 ? teeClock(m.teeTime).replace(/ [AP]M$/, '') : teeClock(m.teeTime)}`)
            : [ms[0].teeTime && teeClock(ms[0].teeTime)];
          return (
            <div key={slot} className="hd-card">
              <div className="hd-card-slot">
                <span>Match {slot}{tag && <span className="hd-card-tag"> · {tag}</span>}</span>
                {tees.some(Boolean) && <span className="hd-card-tee">{tees.filter(Boolean).join(' · ')}</span>}
              </div>
              <div className="hd-card-sides">
                <CardSide ids={ms[0].players.og} team="og" byId={byId} />
                <span className="hd-card-vs">vs</span>
                <CardSide ids={ms[0].players.south} team="south" byId={byId} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "Tee off Fri, Oct 16 · 5:00 PM", then a running clock inside the last day. */
function Countdown({ at }: { at: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const when = Date.parse(at);
  const ms = when - now;
  if (!(ms > 0)) return null;
  if (ms >= 24 * 3600_000) return <span className="hd-countdown"> · Tee off {teeDay(at)}</span>;
  const s = Math.floor(ms / 1000);
  const hms = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v, i) => (i ? String(v).padStart(2, '0') : String(v))).join(':');
  return <span className="hd-countdown"> · Tee off in <b>{hms}</b></span>;
}
