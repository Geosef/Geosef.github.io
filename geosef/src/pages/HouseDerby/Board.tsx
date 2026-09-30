import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  TEAM_NAMES, currentSessionId, dayAndSession, fmtPoints, formatLabel, matchLead, matchSort, nineName, shortStatus, sideName, teeClock, thruLabel,
  useMatches, usePlayers, useSessions, type Match, type Player, type Session,
} from './data';
import { TEAMS, TOTAL_POINTS, cupStanding, matchStates, type HoleOutcome, type TeamId } from './scoring';
import { Maximize, Minimize, Share2, Tv, X } from 'lucide-react';
import { useCupChrome } from './brand';
import CupSplash from './CupSplash';
import { MomentumView, NextView, RecapView, Wipe, useSegment, useWipe } from './Segments';
import ShareSheet from './ShareSheet';
import { decided } from './director';
import { latestMoment, type ScoreEvent } from './scoreEvents';
import { useFit } from './fit';
import { CupLink, vtName } from './nav';
import type { SegmentKind } from './director';
import {
  COMPACT_LANDSCAPE, LAYOUT_SURFACE, STANDALONE, boardLayout, canFullscreen, toggleFullscreen, useFullscreen, useMedia, usePortrait, useWakeLock,
  type BoardLayout,
} from './display';
import Logo from './Logo';
import { BANNER_MS, CELEBRATE_MS, useCountUp, useScoreMoments, type Banner, type Celebration } from './useScoreMoments';
import './HouseDerby.css';


type Standing = ReturnType<typeof cupStanding>;
type Moments = ReturnType<typeof useScoreMoments>;
type Flash = { result: HoleOutcome; key: number } | undefined;
type BoardProps = {
  standing: Standing; session: Session; matches: Match[]; byId: Map<string, Player>; moments: Moments; intro: boolean;
  /** A dead-time segment in place of the match rows, if one is up. */
  body?: React.ReactNode;
  /** Bumps to play the segment wipe. */
  wipe?: number;
};

export default function Board() {
  const [params] = useSearchParams();
  const layout = boardLayout(params.get('tv'), usePortrait());
  const { sessions, error: sErr } = useSessions();
  const { matches, error: mErr } = useMatches();
  const { players, byId, error: pErr } = usePlayers();
  const moments = useScoreMoments(matches);
  // On a phone on its side Safari's bars eat the height, and they only
  // collapse on scroll. So there the landscape board scrolls a little (and
  // stays pinned) instead of locking, unless the bars are already gone.
  const fullscreen = useFullscreen();
  const compact = useMedia(COMPACT_LANDSCAPE);
  const standalone = useMedia(STANDALONE);
  const swipe = layout === 'tv' && compact && !standalone && !fullscreen;
  useCupChrome(
    'House Derby',
    swipe ? { ...LAYOUT_SURFACE.tv, lock: false } : LAYOUT_SURFACE[layout],
    layout === 'phone' ? '/cup/manifest.json' : '/cup/tv.webmanifest',
  );
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
      {ready && (
        <BoardView
          layout={layout} sessions={sessions} matches={matches} byId={byId} moments={moments} intro={intro} awake={awake} swipe={swipe}
          scene={pinnedScene(params.get('scene'))}
          replay={params.get('replay')}
        />
      )}
      {(!ready || intro) && <CupSplash leaving={ready} />}
    </>
  );
}

/** ?scene=board|recap|momentum|next holds the TV on one segment (previews, or a manual override). */
function pinnedScene(v: string | null): SegmentKind | null {
  return v === 'board' || v === 'recap' || v === 'momentum' || v === 'next' ? v : null;
}

function BoardView({ layout, sessions, matches, byId, moments, intro, awake, swipe, scene, replay }: {
  layout: BoardLayout; sessions: Session[]; matches: Match[]; byId: Map<string, Player>; moments: Moments; intro: boolean; awake: boolean;
  /** Landscape phone in the browser: scroll room so a swipe hides the bars. */
  swipe: boolean;
  scene: SegmentKind | null;
  /** ?replay loops the latest moment (?replay=<match id> for one match) for recording clips. */
  replay: string | null;
}) {
  // Tapping into a match saves the stage tab and scroll position; coming back
  // restores them once. (Only for that round trip: a later visit opens on
  // the live stage as usual.)
  const [back] = useState(() => {
    const saved = recall(RETURN_KEY);
    remember(RETURN_KEY, null);
    try { return saved ? (JSON.parse(saved) as { stage: string; y: number }) : null; } catch { return null; }
  });
  const [picked, setPicked] = useState<string | null>(back?.stage ?? null);
  useLayoutEffect(() => {
    if (layout === 'phone' && back?.y) window.scrollTo(0, back.y);
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [sharing, setSharing] = useState(false);
  // Clips need a finished nine to replay (and the race a point on the board).
  const momentClip = latestMoment(matches).length ? '/cup?tv&replay' : undefined;
  // Dead-time segments for the TV boards; score moments hold the live board.
  const replaying = layout !== 'phone' ? replay : null;
  // ?replay=race loops the race to 18's entrance instead of a score moment.
  const raceClip = replaying === 'race';
  useReplay(moments.play, matches, raceClip ? null : replaying);
  const raceTake = useLoop(raceClip, RACE_CLIP_MS);
  // A replay holds its segment so the rotation doesn't cut into a recording.
  const { shown: segment, wipe } = useWipe(useSegment(sessions, matches, raceClip ? 'momentum' : replaying !== null ? 'board' : scene, !!(moments.banner || moments.celebration)));
  const standing = cupStanding(matches);
  const sorted = [...matches].sort(matchSort(sessions));
  const current = currentSessionId(sessions, matches);
  const inSession = (s: Session) => sorted.filter(m => m.session === s.id);

  if (layout !== 'phone') {
    // Stages are played one at a time, so the live board holds on the current
    // one (same rule as the phone board's default tab). While a match result
    // banner is up, it shows the session that result came from; during a
    // recap or preview, that segment's session.
    const bannerSession = moments.banner?.kind === 'point' ? sessions.find(s => s.id === (moments.banner as Extract<Banner, { kind: 'point' }>).session) : undefined;
    const segSession = 'session' in segment ? sessions.find(s => s.id === segment.session) : undefined;
    // A replay stays on its match's stage between loops, so a clip doesn't jump stages.
    const replayed = replaying !== null && !raceClip ? latestMoment(matches, replaying || undefined).find(e => e.kind === 'point') : undefined;
    const replaySession = replayed?.kind === 'point' ? sessions.find(s => s.id === replayed.session) : undefined;
    const shown = bannerSession ?? replaySession ?? segSession ?? sessions.find(s => s.id === current) ?? sessions[0];
    const body = segment.kind === 'momentum' ? <MomentumView key={raceTake} sessions={sessions} matches={matches} />
      : !segSession ? null
      : segment.kind === 'recap' ? <RecapView session={segSession} matches={matches} byId={byId} />
      : <NextView session={segSession} matches={matches} byId={byId} vertical={layout !== 'tv'} />;
    const props = { standing, session: shown, matches: inSession(shown), byId, moments, intro, body, wipe };
    return (
      <>
        {layout === 'tv' ? <TvBoard {...props} swipe={swipe} /> : <VerticalBoard {...props} fill={layout === 'portrait'} />}
        <TvControls />
        {!awake ? <WakeHint /> : swipe && <SwipeHint />}
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
        <div className="hd-session-actions">
          <button type="button" className="hd-tv-link" onClick={() => setSharing(true)}><Share2 aria-hidden />Share</button>
          <Link to="/cup?tv" className="hd-tv-link"><Tv aria-hidden />TV view</Link>
        </div>
      </div>
      <div className="hd-rows">
        {inSession(shown).map((m, i) => (
          <CupLink
            key={m.id} to={`/cup/match/${m.id}`} className="hd-row-link" style={{ ...stagger(i), ...vtName(`match-${m.id}`) }}
            onClick={() => remember(RETURN_KEY, JSON.stringify({ stage: shown.id, y: window.scrollY }))}
          >
            <MatchRow match={m} byId={byId} flash={moments.flashes[m.id]} />
          </CupLink>
        ))}
      </div>
      <nav className="hd-board-links" aria-label="Teams">
        {TEAMS.map(t => <CupLink key={t} to={`/cup/team/${t}`} className={t}><Logo name={t} className="hd-board-link-logo" />{TEAM_NAMES[t]} roster</CupLink>)}
      </nav>
      <footer className="hd-board-foot">
        <Logo name="ggc" className="hd-foot-logo" />
        <span>Gimme Golf Club</span>
      </footer>
      {moments.celebration && <CelebrationOverlay c={moments.celebration} onDone={moments.dismissCelebration} />}
      {sharing && (
        <ShareSheet
          onClose={() => setSharing(false)}
          options={[
            { label: 'Standings', spec: { kind: 'standings', sessions, matches }, clip: momentClip },
            // The stage on screen, once it has a result.
            ...(decided(matches, shown.id).length ? [{ label: `${shown.name} results`, spec: { kind: 'recap' as const, session: shown, matches, byId }, clip: momentClip }] : []),
            ...(momentClip ? [{ label: `Race to ${TOTAL_POINTS / 2}`, spec: { kind: 'race' as const, sessions, matches }, clip: '/cup?tv&replay=race' }] : []),
          ]}
        />
      )}
    </div>
  );
}

const INTRO_MS = 1600;

/** True for the board's first moments on screen, while its entrance plays. */
function useIntro(ready: boolean): boolean {
  // Returning to a board whose data is already in memory skips the splash.
  const [done, setDone] = useState(ready);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setDone(true), INTRO_MS);
    return () => clearTimeout(t);
  }, [ready]);
  return ready && !done;
}

/**
 * Loops a moment rebuilt from the data (`latestMoment`) so anyone can screen
 * record a clip for Stories: the closing hole's flash, the point banner and
 * horseshoe swing, or the clinch celebration. `id` narrows it to one match.
 */
function useReplay(play: (events: ScoreEvent[]) => void, matches: Match[], id: string | null) {
  const latest = useRef(matches);
  latest.current = matches;
  useEffect(() => {
    if (id === null) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      const events = latestMoment(latest.current, id || undefined);
      play(events);
      // Wait out the banners (point, then any lead takeover) or the celebration, then pause.
      const busy = events.reduce((ms, e) => ms + (e.kind === 'clinch' ? CELEBRATE_MS : e.kind === 'point' || e.kind === 'lead' ? BANNER_MS[e.kind] : 0), 0);
      t = setTimeout(loop, busy + 2_000);
    };
    // Start once the entrance has settled.
    t = setTimeout(loop, 1_800);
    return () => clearTimeout(t);
  }, [id, play]);
}

/** Where the phone board was when a match was opened (see BoardView). */
const RETURN_KEY = 'hd-return';

// Per-tab memory for the phone board. Storage can be blocked (private mode);
// then it just doesn't remember.
function recall(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function remember(key: string, value: string | null) {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* not remembered */ }
}

/** The race clip's loop: its entrance (bar, lines, labels) runs about 2.5s, then holds. */
const RACE_CLIP_MS = 7_000;

/** Counts up every `ms` while `on`; keying a view on it replays its entrance. */
function useLoop(on: boolean, ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setN(x => x + 1), ms);
    return () => clearInterval(t);
  }, [on, ms]);
  return n;
}

/** Entrance delay for the i-th row, read by the .hd-intro animations. */
const stagger = (i: number) => ({ ['--i' as string]: i });

/**
 * Exit (back to the phone board) and, where the browser allows it, full
 * screen. Hidden until the screen is touched or the mouse moves, so they
 * never show on an unattended TV or a stream capture.
 */
function TvControls() {
  const fullscreen = useFullscreen();
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
  if (!shown) return null;
  return (
    <div className="hd-tv-controls">
      <Link to="/cup" aria-label="Exit TV view"><X aria-hidden /></Link>
      {canFullscreen() && (
        <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
          {fullscreen ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
        </button>
      )}
    </div>
  );
}

/** Nudge to swipe the browser's bars away, until the board is scrolled. */
function SwipeHint() {
  const [scrolled, setScrolled] = useState(() => window.scrollY > 0);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled ? null : <div className="hd-wake-hint">Swipe up for full screen</div>;
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

/** One-shot glow over the new leader's score block (both, when the cup goes level). */
function LeadGlow({ moments, team }: { moments: Moments; team: TeamId }) {
  const g = moments.leadGlow;
  return g && (g.team === team || g.team === null) ? <span key={g.key} className="hd-lead-glow" aria-hidden /> : null;
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
        {TEAMS.map(t => {
          // On the phone board each half opens that team's roster, morphing
          // into its header.
          const phone = variant === 'phone';
          const Half = phone ? CupLink : 'div';
          return (
          <Half key={t} to={`/cup/team/${t}`} className={`hd-th-team ${t}`} style={phone ? vtName(`team-${t}`) : undefined}>
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
          </Half>
          );
        })}
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
function MatchRow({ match, byId, stacked = false, fit = false, flash, style }: {
  match: Match; byId: Map<string, Player>; stacked?: boolean; flash?: Flash; style?: React.CSSProperties;
  /** Shrink long names to fit (full-screen boards, which run useFit) rather than wrap. */
  fit?: boolean;
}) {
  const states = matchStates(match);
  const { lead, started } = matchLead(states);
  const tone = lead ?? (started ? 'tied' : 'idle');
  // Viewers know a match by its players, so an idle row shows its tee time.
  const status = shortStatus(states) || (match.teeTime ? teeClock(match.teeTime) : '–');
  // Stacked puts each player on their own line (narrow vertical layout).
  const cls = fit ? 'hd-fit' : undefined;
  const names = (t: TeamId) => stacked
    ? sideName(match, t, byId).split(' / ').map(n => <span key={n} className={cls}>{n}</span>)
    : <span className={cls}>{sideName(match, t, byId)}</span>;
  return (
    <div className={`hd-row lead-${tone}`} style={style}>
      <div className={`hd-row-side og ${lead === 'og' ? 'filled' : ''}`}>{names('og')}</div>
      {/* Keyed on the text so the flip replays whenever the status changes. */}
      <div className={`hd-row-status ${tone}`}>
        {match.nine && <span className="hd-row-nine">{nineName(match)}</span>}
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

/** Point banner copy. The detail names the players: that's how viewers know a match. */
function bannerText(b: Extract<Banner, { kind: 'point' }>, pair?: Record<TeamId, string>): { title: string; detail: string; team: TeamId | null } {
  const nine = b.nine ? ` · ${nineName({ nine: b.nine })}` : '';
  if (b.winner) return { title: `${TEAM_NAMES[b.winner]} win ${b.label}`, detail: `${pair?.[b.winner] ?? ''}${nine}`, team: b.winner };
  return { title: 'Halved · ½ each', detail: `${pair ? `${pair.og} v ${pair.south}` : ''}${nine}`, team: null };
}

/**
 * Score moments over the board body on TV and vertical layouts: a pill that
 * slides up for a match result, then, if it swung the cup, the bigger lead
 * takeover.
 */
function ResultBanner({ banner, standing, matches, byId }: {
  banner: Banner | null; standing: Standing; matches: Match[]; byId: Map<string, Player>;
}) {
  if (!banner) return null;
  if (banner.kind === 'lead') return <LeadTakeover leader={banner.leader} key={banner.key} standing={standing} />;
  const m = matches.find(x => x.id === banner.matchId);
  const pair = m && { og: sideName(m, 'og', byId), south: sideName(m, 'south', byId) };
  const { title, detail, team } = bannerText(banner, pair);
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

/**
 * The cup lead changing: the new leader's color sweeps across from their
 * side of the board (gold from the middle when it goes level), with the cup
 * score under the headline.
 */
function LeadTakeover({ leader, standing }: { leader: TeamId | null; standing: Standing }) {
  return (
    <div className={`hd-takeover ${leader ?? 'even'}`} role="status">
      <div className="hd-takeover-body">
        <Logo name={leader ?? 'crest'} className={`hd-takeover-logo ${leader ? 'hd-swing' : ''}`} />
        <div className="hd-takeover-kicker">{leader ? TEAM_NAMES[leader] : 'The Derby is'}</div>
        <div className="hd-takeover-title">{leader ? 'Take the lead' : 'All square'}</div>
        <div className="hd-takeover-score">
          <span className="og">{fmtPoints(standing.points.og)}</span>
          <span className="dash">–</span>
          <span className="south">{fmtPoints(standing.points.south)}</span>
        </div>
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
function VerticalBoard({ standing, session, matches, byId, moments, intro, body, wipe = 0, fill = false }: BoardProps & {
  /** Filling a phone held upright: no bands kept clear for Instagram. */
  fill?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  useFit(frame);
  return (
    <div className={`hd-page hd-vert-page ${intro ? 'hd-intro' : ''}`}>
      <div className={`hd-vert ${fill ? 'hd-vert-fill' : ''}`} ref={frame}>
        <TeamHeader standing={standing} moments={moments} variant="vert" />

        <div className="hd-seg-host">
          {body ?? (
            <>
              <div className="hd-vert-session">{dayAndSession(session)}</div>
              <div className="hd-vert-rows">
                {/* One name per line fits up to 6 rows; Friday's 12 nines need one line per side. */}
                {matches.map((m, i) => (
                  <MatchRow key={m.id} match={m} byId={byId} stacked={matches.length <= 6} fit flash={moments.flashes[m.id]} style={stagger(i)} />
                ))}
                <ResultBanner banner={moments.banner} standing={standing} matches={matches} byId={byId} />
              </div>
            </>
          )}
          <Wipe n={wipe} />
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
function TvBoard({ standing, session, matches, byId, moments, intro, body, wipe = 0, swipe = false }: BoardProps & { swipe?: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  useFit(frame);
  return (
    <div className={`hd-page hd-tv ${intro ? 'hd-intro' : ''} ${swipe ? 'hd-tv-swipe' : ''}`}>
      <div className="hd-tv-frame" ref={frame}>
        <TeamHeader standing={standing} moments={moments} variant="tv" />

        <div className="hd-seg-host">
          {body ?? (
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
                    <span className={`hd-tv-side og ${lead === 'og' ? 'filled' : ''}`}><span className="hd-fit">{sideName(m, 'og', byId)}</span></span>
                    {/* Hole the match is through, like the broadcast "thru" column. */}
                    <span className="hd-tv-slot">
                      <span key={thruLabel(m)} className="hd-flip">{thruLabel(m)}</span>
                      {m.nine && <span className="hd-tv-nine">{nineName(m)}</span>}
                    </span>
                    <span className={`hd-tv-side south ${lead === 'south' ? 'filled' : ''}`}><span className="hd-fit">{sideName(m, 'south', byId)}</span></span>
                    <span className={`hd-tv-status south ${lead === 'south' ? 'filled' : ''}`}>{cell('south')}</span>
                    <FlashOverlay flash={moments.flashes[m.id]} />
                  </div>
                );
              })}
              <ResultBanner banner={moments.banner} standing={standing} matches={matches} byId={byId} />
            </div>
          )}
          <Wipe n={wipe} />
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
