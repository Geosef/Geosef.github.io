import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  TEAM_NAMES, dayAndSession, fmtPoints, formatLabel, matchName, shortStatus, sideName, teeClock, teeDay, type Match, type Player, type Session,
} from './data';
import { BOARD, decided, playlist, segmentAt, segmentKey, toPlay, type Segment, type SegmentKind } from './director';
import { TEAMS, TOTAL_POINTS, cupStanding, matchStates, type TeamId } from './scoring';
import Logo from './Logo';
import { momentum, momentumStats, type MomentumStep } from './momentum';

/**
 * The segment the TV boards show now. `pinned` (from ?scene=) holds one
 * segment regardless; otherwise `hold` keeps the live board up while a score
 * moment plays on it.
 */
export function useSegment(sessions: Session[], matches: Match[], pinned: SegmentKind | null, hold: boolean): Segment {
  const [now, setNow] = useState(() => Date.now());
  const list = playlist(sessions, matches);
  // The cycle runs from the latest score (when dead time began), so after the
  // last putt every screen holds the board, then goes recap, race, up next,
  // in step with each other. Before any score it runs off the clock.
  const anchor = Math.max(0, ...matches.map(m => m.updatedAt ?? 0));
  const { segment, endsIn } = segmentAt(list, Math.max(0, now - anchor));
  useEffect(() => setNow(Date.now()), [anchor]);
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

/** An element's size, kept current as it resizes. */
function useSize(ref: React.RefObject<HTMLElement | null>): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * The race to 18 (TV dead time): a 270-to-win style bar of points won and
 * points being led, split at the winning line, over a timeline of each
 * team's running total through the event.
 */
export function MomentumView({ sessions, matches }: { sessions: Session[]; matches: Match[] }) {
  const steps = momentum(sessions, matches);
  const { changes } = momentumStats(steps);
  const standing = cupStanding(matches);
  const played = standing.points.og + standing.points.south;
  const plot = useRef<HTMLDivElement>(null);
  const size = useSize(plot);
  return (
    <div className="hd-seg hd-momentum">
      <div className="hd-seg-title">
        <span>Race to {TOTAL_POINTS / 2}</span>
        <span className="hd-seg-kicker">
          {fmtPoints(played)} of {TOTAL_POINTS} played · {changes} lead change{changes === 1 ? '' : 's'}
        </span>
      </div>
      <RaceBar standing={standing} />
      <div className="hd-momentum-plot" ref={plot}>
        {size && size.w > 0 && <RaceChart steps={steps} sessions={sessions} matches={matches} w={size.w} h={size.h} />}
      </div>
    </div>
  );
}

/**
 * All 36 points as one bar: OG fill from the left, South from the right.
 * Solid is won, striped is leading right now, the gray middle is still to
 * play. The line in the middle is the winning line (OG keep the Derby at
 * 18; South need 18½).
 */
function RaceBar({ standing }: { standing: ReturnType<typeof cupStanding> }) {
  const pct = (n: number) => `${(n / TOTAL_POINTS) * 100}%`;
  const { points, projected } = standing;
  const leading = (t: TeamId) => Math.max(0, projected[t] - points[t]);
  return (
    <div className="hd-race">
      <div className="hd-race-ends">
        {TEAMS.map(t => (
          <div key={t} className={`hd-race-end ${t}`}>
            <Logo name={t} className="hd-race-logo" />
            <span className="hd-race-pts">{fmtPoints(points[t])}</span>
            <span className="hd-race-meta">
              <span>{TEAM_NAMES[t]}</span>
              <span>Proj {fmtPoints(projected[t])}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="hd-race-bar" role="img"
        aria-label={`OG ${fmtPoints(points.og)} won, ${fmtPoints(leading('og'))} leading; South ${fmtPoints(points.south)} won, ${fmtPoints(leading('south'))} leading; ${TOTAL_POINTS / 2} to win.`}>
        <span className="won og" style={{ left: 0, width: pct(points.og) }} />
        <span className="lead og" style={{ left: pct(points.og), width: pct(leading('og')) }} />
        <span className="won south" style={{ right: 0, width: pct(points.south) }} />
        <span className="lead south" style={{ right: pct(points.south), width: pct(leading('south')) }} />
        <span className="hd-race-line" />
      </div>
      <div className="hd-race-key">
        <span><i className="won" />Won</span>
        <span><i className="lead" />Leading now</span>
        <span><i className="line" />{TOTAL_POINTS / 2} to win · OG keep the Derby on a tie, South need {fmtPoints(TOTAL_POINTS / 2 + 0.5)}</span>
      </div>
    </div>
  );
}

const INK = '#2b2d3a';
const MUTED = '#6b6a62';
const GRID = '#e2dfcf';
const GOLD = '#c4935f';
const SURFACE = '#f8f6ea';
const TEAM_HEX: Record<TeamId, string> = { og: '#3f4463', south: '#5e7a66' };
const DRAW_ORDER: TeamId[] = ['south', 'og'];

/**
 * Each team's running total after every decided point, across the whole
 * event: the x axis is all 36 points split into stages (stages still to come
 * are ghosted), so the lines stop at "now" with the rest of the race ahead.
 */
function RaceChart({ steps, sessions, matches, w, h }: {
  steps: MomentumStep[]; sessions: Session[]; matches: Match[]; w: number; h: number;
}) {
  const target = TOTAL_POINTS / 2;
  const top = Math.max(target + 2, ...steps.map(s => Math.max(s.points.og, s.points.south) + 1));
  const font = Math.max(12, Math.min(h * 0.06, w * 0.028));
  const pad = { l: font * 1.8, r: font * 5.2, t: font * 0.8, b: font * 2 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / TOTAL_POINTS) * pw;
  const y = (v: number) => pad.t + ph - (v / top) * ph;
  const r = Math.max(3, Math.min(font * 0.3, (pw / TOTAL_POINTS) * 0.3));

  // Stage bands: each stage is as wide as its points.
  const ordered = [...sessions].sort((a, b) => a.order - b.order);
  const bands: Array<{ s: Session; from: number; to: number; started: boolean }> = [];
  let at = 0;
  for (const s of ordered) {
    const n = matches.filter(m => m.session === s.id).flatMap(matchStates).length;
    bands.push({ s, from: at, to: at + n, started: steps.some(st => st.session === s.id) });
    at += n;
  }

  const lineFor = (t: TeamId) => [{ v: 0, i: 0 }, ...steps.map((s, k) => ({ v: s.points[t], i: k + 1 }))]
    .map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const now = steps.length;
  const last = steps[now - 1]?.points ?? { og: 0, south: 0 };
  // End labels: nudge apart when the teams are level or close.
  const gap = font * 1.1;
  const ly = { og: y(last.og), south: y(last.south) };
  if (Math.abs(ly.og - ly.south) < gap) {
    const mid = (ly.og + ly.south) / 2;
    const ogHigher = last.og >= last.south;
    ly.og = mid + (ogHigher ? -gap / 2 : gap / 2);
    ly.south = mid + (ogHigher ? gap / 2 : -gap / 2);
  }
  const ticks = [0, 6, 12, 18].filter(v => v <= top);

  return (
    <svg className="hd-momentum-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img"
      aria-label={`Running points after each of ${now} decided points: OG ${fmtPoints(last.og)}, South ${fmtPoints(last.south)}. ${target} to win.`}>
      {/* Stages still to come are ghosted. */}
      {bands.map((b, k) => (
        <g key={b.s.id}>
          {!b.started && <rect x={x(b.from)} y={pad.t} width={x(b.to) - x(b.from)} height={ph} fill={GRID} fillOpacity={0.35} />}
          {k > 0 && <line x1={x(b.from)} x2={x(b.from)} y1={pad.t} y2={pad.t + ph} stroke={GRID} strokeWidth={2} />}
          <text x={(x(b.from) + x(b.to)) / 2} y={h - font * 0.5} textAnchor="middle" fontSize={font * 0.72} fill={b.started ? MUTED : GRID}>
            {stageShort(b.s)}
          </text>
        </g>
      ))}

      {ticks.map(v => (
        <g key={v}>
          <line x1={pad.l} x2={pad.l + pw} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
          <text x={pad.l - font * 0.4} y={y(v)} dy="0.35em" textAnchor="end" fontSize={font * 0.72} fill={MUTED}>{v}</text>
        </g>
      ))}

      {/* The winning line. */}
      <line x1={pad.l} x2={pad.l + pw} y1={y(target)} y2={y(target)} stroke={GOLD} strokeWidth={3} strokeDasharray="10 6" />
      <text x={pad.l + pw + font * 0.4} y={y(target)} dy="0.35em" fontSize={font * 0.85} fill={GOLD}>{target} to win</text>

      {/* OG drawn last, so it sits on top when level: they hold the tiebreak. */}
      {DRAW_ORDER.map(t => (
        <path key={t} className="hd-mo-line" d={lineFor(t)} fill="none" stroke={TEAM_HEX[t]}
          strokeWidth={Math.max(2.5, font * 0.2)} strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
      ))}
      {now > 0 && DRAW_ORDER.map(t => (
        <g key={t} className="hd-mo-end">
          <circle cx={x(now)} cy={y(last[t])} r={r * 1.6} fill={TEAM_HEX[t]} stroke={SURFACE} strokeWidth={2} />
          <text x={x(now) + r * 2.4} y={ly[t]} dy="0.35em" fontSize={font} fill={INK}>
            {t === 'og' ? 'OG' : 'South'} {fmtPoints(last[t])}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** "Fri Wave 1", "Sat Scramble": short enough for the chart's bottom axis. */
function stageShort(s?: Session): string {
  if (!s) return '';
  return `${s.day === 'fri' ? 'Fri' : 'Sat'} ${s.name}`;
}
