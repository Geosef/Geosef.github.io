import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  TEAM_NAMES, currentSessionId, dayAndSession, fmtPoints, formatLabel, matchLead, matchName, matchSort, nineName, shortStatus, sideName, thruLabel,
  useMatches, usePlayers, useSessions, type Match, type Player, type Session,
} from './data';
import { TEAMS, cupStanding, matchStates, type HoleOutcome, type TeamId } from './scoring';
import { Tv, X } from 'lucide-react';
import { useCupChrome } from './brand';
import CupSplash from './CupSplash';
import { LAYOUT_SURFACE, boardLayout, usePortrait, useWakeLock, type BoardLayout } from './display';
import Logo from './Logo';
import { useCountUp, useScoreMoments, type Banner, type Celebration } from './useScoreMoments';
import './HouseDerby.css';


type Standing = ReturnType<typeof cupStanding>;
type Moments = ReturnType<typeof useScoreMoments>;
type Flash = { result: HoleOutcome; key: number } | undefined;
type BoardProps = {
  standing: Standing; session: Session; matches: Match[]; byId: Map<string, Player>; moments: Moments; intro: boolean;
};

export default function Board() {
  const [params] = useSearchParams();
  const layout = boardLayout(params.get('tv'), usePortrait());
  const { sessions, error: sErr } = useSessions();
  const { matches, error: mErr } = useMatches();
  const { players, byId, error: pErr } = usePlayers();
  const moments = useScoreMoments(matches);
  useCupChrome('House Derby', LAYOUT_SURFACE[layout]);
  // Boards left running on a TV or a phone in a cart shouldn't sleep.
  const awake = useWakeLock(layout !== 'phone');
  // Players too, so names don't pop into rows that rendered without them.
  const ready = !!(sessions && matches && players);
  const intro = useIntro(ready);

  const error = sErr ?? mErr ?? pErr;
  if (error) return <div className="hd-page"><p className="hd-error">{error}</p></div>;
  // The splash stays mounted through the handoff and fades out over the
  // finished board, so nothing underneath is seen half drawn.
  return (
    <>
      {ready && <BoardView layout={layout} sessions={sessions} matches={matches} byId={byId} moments={moments} intro={intro} awake={awake} />}
      {(!ready || intro) && <CupSplash leaving={ready} />}
    </>
  );
}

function BoardView({ layout, sessions, matches, byId, moments, intro, awake }: {
  layout: BoardLayout; sessions: Session[]; matches: Match[]; byId: Map<string, Player>; moments: Moments; intro: boolean; awake: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const standing = cupStanding(matches);
  const sorted = [...matches].sort(matchSort(sessions));
  const current = currentSessionId(sessions, matches);
  const inSession = (s: Session) => sorted.filter(m => m.session === s.id);

  if (layout !== 'phone') {
    // Stages are played one at a time, so the TV holds on the current one (same
    // rule as the phone board's default tab) rather than rotating. While a
    // match result banner is up, it shows the session that result came from.
    const bannerSession = moments.banner?.kind === 'point' ? sessions.find(s => s.id === (moments.banner as Extract<Banner, { kind: 'point' }>).session) : undefined;
    const shown = bannerSession ?? sessions.find(s => s.id === current) ?? sessions[0];
    const props = { standing, session: shown, matches: inSession(shown), byId, moments, intro };
    return (
      <>
        {layout === 'tv' ? <TvBoard {...props} /> : <VerticalBoard {...props} fill={layout === 'portrait'} />}
        <ExitTv />
        {!awake && <WakeHint />}
        {moments.celebration && <CelebrationOverlay c={moments.celebration} onDone={moments.dismissCelebration} />}
      </>
    );
  }

  const shown = sessions.find(s => s.id === (picked ?? current)) ?? sessions[0];

  return (
    <div className={`hd-page hd-board ${intro ? 'hd-intro' : ''}`}>
      <TeamHeader standing={standing} moments={moments} variant="phone" />

      <nav className="hd-tabs" aria-label="Sessions">
        {sessions.map(s => (
          <button
            key={s.id}
            className={s.id === shown.id ? 'selected' : ''}
            aria-current={s.id === shown.id}
            onClick={() => setPicked(s.id)}
          >
            <span className="hd-tab-day">{s.day === 'fri' ? 'Fri' : 'Sat'}</span>
            {s.name}
            {s.id === current && <span className="hd-live-dot" aria-label="current" />}
          </button>
        ))}
      </nav>

      <div className="hd-session-bar">
        <h2 className="hd-session-title">
          {dayAndSession(shown)}
          <span className="hd-muted"> · {formatLabel(shown)} · {shown.venue}</span>
        </h2>
        <Link to="/cup?tv" className="hd-tv-link"><Tv aria-hidden />TV view</Link>
      </div>
      <div className="hd-rows">
        {inSession(shown).map((m, i) => (
          <Link key={m.id} to={`/cup/match/${m.id}`} className="hd-row-link" style={stagger(i)}>
            <MatchRow match={m} byId={byId} flash={moments.flashes[m.id]} />
          </Link>
        ))}
      </div>
      <footer className="hd-board-foot">
        <Logo name="ggc" className="hd-foot-logo" />
        <span>Gimme Golf Club</span>
      </footer>
      {moments.celebration && <CelebrationOverlay c={moments.celebration} onDone={moments.dismissCelebration} />}
    </div>
  );
}

const INTRO_MS = 1600;

/** True for the board's first moments on screen, while its entrance plays. */
function useIntro(ready: boolean): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setDone(true), INTRO_MS);
    return () => clearTimeout(t);
  }, [ready]);
  return ready && !done;
}

/** Entrance delay for the i-th row, read by the .hd-intro animations. */
const stagger = (i: number) => ({ ['--i' as string]: i });

/**
 * Way back to the phone board from a full-screen one. Hidden until the screen
 * is touched or the mouse moves, so it never shows on an unattended TV or a
 * stream capture.
 */
function ExitTv() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const show = () => setShown(n => n + 1);
    window.addEventListener('pointerdown', show);
    window.addEventListener('pointermove', show);
    return () => {
      window.removeEventListener('pointerdown', show);
      window.removeEventListener('pointermove', show);
    };
  }, []);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(0), 3000);
    return () => clearTimeout(t);
  }, [shown]);
  return shown ? <Link to="/cup" className="hd-tv-exit" aria-label="Exit TV view"><X aria-hidden /></Link> : null;
}

/**
 * iOS only keeps the screen on after a tap, so touch screens get a prompt
 * until the lock is held. Mouse-driven and unattended screens never see it.
 */
function WakeHint() {
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (!touch || !('wakeLock' in navigator)) return null;
  return <div className="hd-wake-hint">Tap to keep screen on</div>;
}

/** Big score that counts up and bumps when it changes. */
function Points({ value, className }: { value: number; className: string }) {
  const shown = useCountUp(value);
  return <span key={shown} className={`${className} hd-bump`}>{fmtPoints(shown)}</span>;
}

/** Team horseshoe that swings with a gold gleam each time the team wins a point. */
function TeamLogo({ team, moments, className = '' }: { team: TeamId; moments: Moments; className?: string }) {
  const n = moments.pulse[team];
  return <Logo name={team} className={`hd-team-logo ${n ? 'hd-swing' : ''} ${className}`} animKey={n} />;
}

/** One-shot glow over the team's score block when they take the lead. */
function LeadGlow({ moments, team }: { moments: Moments; team: TeamId }) {
  const g = moments.leadGlow;
  return g && g.team === team ? <span key={g.key} className="hd-lead-glow" aria-hidden /> : null;
}

/**
 * The team score header, shared by every view so they stay in step: split
 * navy/green halves, each with its horseshoe, name, score, points needed and
 * projection, and the Derby crest on the seam. On the phone and vertical
 * boards the crest centers on the top edge of the halves; on TV it sits
 * between them.
 */
function TeamHeader({ standing, moments, variant }: {
  standing: Standing; moments: Moments; variant: 'phone' | 'vert' | 'tv';
}) {
  return (
    <header className={`hd-th hd-th-${variant}`}>
      <div className="hd-th-row">
        {TEAMS.map(t => (
          <div key={t} className={`hd-th-team ${t}`}>
            <LeadGlow moments={moments} team={t} />
            <TeamLogo team={t} moments={moments} className="hd-th-logo" />
            <div className="hd-th-text">
              <div className="hd-th-name">{TEAM_NAMES[t]}</div>
              <div className="hd-th-meta">
                <span>{needLine(standing, t)}</span>
                {!standing.clinched && <span>Proj {fmtPoints(standing.projected[t])}</span>}
              </div>
            </div>
            <Points value={standing.points[t]} className="hd-th-points" />
          </div>
        ))}
        <Logo name="crest" className="hd-th-crest" label="Gimme House Derby" />
      </div>
    </header>
  );
}

/** A one-shot wash of team color over a row when a hole is recorded. */
function FlashOverlay({ flash }: { flash: Flash }) {
  return flash ? <span key={flash.key} className={`hd-flash ${flash.result}`} aria-hidden /> : null;
}

/**
 * Leaderboard row in the Golf Genius style: the leading side's cell fills with
 * its team color and the status arrow points toward it.
 */
function MatchRow({ match, byId, stacked = false, flash, style }: {
  match: Match; byId: Map<string, Player>; stacked?: boolean; flash?: Flash; style?: React.CSSProperties;
}) {
  const states = matchStates(match);
  const { lead, started } = matchLead(states);
  const tone = lead ?? (started ? 'tied' : 'idle');
  // The F9/B9 tag names the nine, so an idle row only needs the match number.
  const status = shortStatus(states) || `Match ${match.slot}`;
  // Stacked puts each player on their own line (narrow vertical layout).
  const names = (t: TeamId) => stacked
    ? sideName(match, t, byId).split(' / ').map(n => <span key={n}>{n}</span>)
    : sideName(match, t, byId);
  return (
    <div className={`hd-row lead-${tone}`} style={style}>
      <div className={`hd-row-side og ${lead === 'og' ? 'filled' : ''}`}>{names('og')}</div>
      {/* Keyed on the text so the flip replays whenever the status changes. */}
      <div className={`hd-row-status ${tone}`}>
        {match.nine && <span className="hd-row-nine">{match.nine === 'front' ? 'F9' : 'B9'}</span>}
        <span key={status} className="hd-flip">{status}</span>
      </div>
      <div className={`hd-row-side south ${lead === 'south' ? 'filled' : ''}`}>{names('south')}</div>
      <FlashOverlay flash={flash} />
    </div>
  );
}

/** Words under each team's score: points needed, or the clinch. */
function needLine(standing: Standing, t: TeamId): string {
  const { needed, clinched } = standing;
  if (clinched) return clinched === t ? 'Derby winners' : '';
  return `${fmtPoints(needed[t])} to win`;
}

function bannerText(b: Banner): { title: string; detail: string; team: TeamId | null } {
  if (b.kind === 'lead') {
    return b.leader
      ? { title: `${TEAM_NAMES[b.leader]} take the lead`, detail: '', team: b.leader }
      : { title: 'All square', detail: 'The Derby is level', team: null };
  }
  const nine = b.nine ? ` · ${nineName({ nine: b.nine })}` : '';
  return b.winner
    ? { title: `${TEAM_NAMES[b.winner]} win Match ${b.slot}`, detail: `${b.label}${nine}`, team: b.winner }
    : { title: `Match ${b.slot} halved`, detail: `½ point each${nine}`, team: null };
}

/** Result banner that slides over the board on TV and vertical layouts. */
function ResultBanner({ banner }: { banner: Banner | null }) {
  if (!banner) return null;
  const { title, detail, team } = bannerText(banner);
  return (
    <div key={banner.key} className={`hd-banner ${team ?? 'even'}`} role="status">
      {team ? <Logo name={team} className="hd-banner-logo hd-swing" /> : <Logo name="mark" className="hd-banner-logo" />}
      <div>
        <div className="hd-banner-title">{title}</div>
        {detail && <div className="hd-banner-detail">{detail}</div>}
      </div>
    </div>
  );
}

const CONFETTI = Array.from({ length: 48 }, (_, i) => i);

/** Full-screen crest reveal when the Derby is won. Tap to dismiss. */
function CelebrationOverlay({ c, onDone }: { c: Celebration; onDone: () => void }) {
  return (
    <div className={`hd-celebrate ${c.team}`} onClick={onDone} role="alert">
      <div className="hd-confetti" aria-hidden>
        {CONFETTI.map(i => (
          <span
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              animationDelay: `${(i % 12) * 0.18}s`,
              animationDuration: `${2.6 + (i % 5) * 0.35}s`,
            }}
            className={['c-team', 'c-gold', 'c-cream'][i % 3]}
          />
        ))}
      </div>
      <Logo name="crest" className="hd-celebrate-crest hd-gleam" label="Gimme House Derby" />
      <div className="hd-celebrate-title">
        {TEAM_NAMES[c.team]} win the Derby
      </div>
      <Logo name={c.team} className="hd-celebrate-team hd-swing" />
    </div>
  );
}

/**
 * 9:16 board for Instagram Live. Instagram overlays the account/viewer count
 * across the top and comments across the bottom, so those bands only carry
 * the title and footer; scores and matches sit in the middle.
 */
function VerticalBoard({ standing, session, matches, byId, moments, intro, fill = false }: BoardProps & {
  /** Filling a phone held upright: no bands kept clear for Instagram. */
  fill?: boolean;
}) {
  return (
    <div className={`hd-page hd-vert-page ${intro ? 'hd-intro' : ''}`}>
      <div className={`hd-vert ${fill ? 'hd-vert-fill' : ''}`}>
        <TeamHeader standing={standing} moments={moments} variant="vert" />

        <div className="hd-vert-session">{dayAndSession(session)}</div>

        <div className="hd-vert-rows">
          {/* One name per line fits up to 6 rows; Friday's 12 nines need one line per side. */}
          {matches.map((m, i) => (
            <MatchRow key={m.id} match={m} byId={byId} stacked={matches.length <= 6} flash={moments.flashes[m.id]} style={stagger(i)} />
          ))}
          <ResultBanner banner={moments.banner} />
        </div>

        <div className="hd-vert-foot">
          <Venue session={session} />
          <span>{formatLabel(session)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Venue and town for the TV footers. The Gimme mark only appears when the
 * venue is Gimme's own; elsewhere it's just a location.
 */
function Venue({ session }: { session: Session }) {
  const gimme = session.venue === 'Gimme Golf Club';
  return (
    <span className="hd-venue">
      {gimme && <Logo name="ggc" className="hd-foot-logo" />}
      <span className="hd-venue-text">
        <span className="hd-venue-name">{session.venue}</span>
        {session.location && <span className="hd-venue-town">{session.location}</span>}
      </span>
    </span>
  );
}

/** Full-screen broadcast layout for the clubhouse / OG House screens. */
function TvBoard({ standing, session, matches, byId, moments, intro }: BoardProps) {
  return (
    <div className={`hd-page hd-tv ${intro ? 'hd-intro' : ''}`}>
      <div className="hd-tv-frame">
        <TeamHeader standing={standing} moments={moments} variant="tv" />

        <div className="hd-tv-rows">
          {matches.map((m, i) => {
            const states = matchStates(m);
            const { lead, started } = matchLead(states);
            const status = shortStatus(states);
            const cell = (t: TeamId) => (lead === t || (started && !lead)
              ? <span key={status} className="hd-flip">{status}</span>
              : '');
            return (
              <div key={m.id} className="hd-tv-row" style={stagger(i)}>
                <span className={`hd-tv-status og ${lead === 'og' ? 'filled' : ''}`}>{cell('og')}</span>
                <span className={`hd-tv-side og ${lead === 'og' ? 'filled' : ''}`}>{sideName(m, 'og', byId)}</span>
                {/* Hole the match is through, like the broadcast "thru" column. */}
                <span className="hd-tv-slot" title={matchName(m)}>
                  <span key={thruLabel(m)} className="hd-flip">{thruLabel(m)}</span>
                  {m.nine && <span className="hd-tv-nine">{m.nine === 'front' ? 'F9' : 'B9'}</span>}
                </span>
                <span className={`hd-tv-side south ${lead === 'south' ? 'filled' : ''}`}>{sideName(m, 'south', byId)}</span>
                <span className={`hd-tv-status south ${lead === 'south' ? 'filled' : ''}`}>{cell('south')}</span>
                <FlashOverlay flash={moments.flashes[m.id]} />
              </div>
            );
          })}
          <ResultBanner banner={moments.banner} />
        </div>

        <footer className="hd-tv-foot">
          <span>{dayAndSession(session)}</span>
          <Venue session={session} />
          <span>{formatLabel(session)}</span>
        </footer>
      </div>
    </div>
  );
}
