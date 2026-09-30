import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FORMAT_NAMES, TEAM_NAMES, currentSessionId, fmtPoints, matchLead, matchSort, shortStatus, sideName,
  useMatches, usePlayers, useSessions, type Match, type Player, type Session,
} from './data';
import { DEFENDING_TEAM, TEAMS, cupStanding, matchStates, type HoleOutcome, type TeamId } from './scoring';
import { useCupChrome } from './brand';
import Logo from './Logo';
import { useCountUp, useScoreMoments, type Banner, type Celebration } from './useScoreMoments';
import './HouseDerby.css';

const TV_ROTATE_MS = 20_000;
const CHALLENGER: TeamId = DEFENDING_TEAM === 'og' ? 'south' : 'og';

type Standing = ReturnType<typeof cupStanding>;
type Moments = ReturnType<typeof useScoreMoments>;
type Flash = { result: HoleOutcome; key: number } | undefined;

export default function Board() {
  const [params] = useSearchParams();
  const tv = params.has('tv');
  // ?tv=vertical: 9:16 layout for streaming to Instagram Live.
  const vertical = params.get('tv') === 'vertical';
  const { sessions, error: sErr } = useSessions();
  const { matches, error: mErr } = useMatches();
  const { byId } = usePlayers();
  const [picked, setPicked] = useState<string | null>(null);
  const [tvIndex, setTvIndex] = useState(0);
  const moments = useScoreMoments(matches);
  useCupChrome();

  useEffect(() => {
    if (!tv) return;
    const t = setInterval(() => setTvIndex(i => i + 1), TV_ROTATE_MS);
    return () => clearInterval(t);
  }, [tv]);

  const error = sErr ?? mErr;
  if (error) return <div className="hd-page"><p className="hd-error">{error}</p></div>;
  if (!sessions || !matches) return <div className="hd-page"><p className="hd-muted">Loading…</p></div>;

  const standing = cupStanding(matches);
  const sorted = [...matches].sort(matchSort(sessions));
  const current = currentSessionId(sessions, matches);
  const inSession = (s: Session) => sorted.filter(m => m.session === s.id);

  if (tv) {
    // Cycle through sessions that have started, unless exactly one is live.
    const phases = (s: Session) => inSession(s).flatMap(m => matchStates(m).map(st => st.phase));
    const started = sessions.filter(s => phases(s).some(p => p !== 'not-started'));
    const live = started.filter(s => phases(s).includes('live'));
    const pool = live.length === 1 ? live : started.length ? started : sessions;
    // While a match result is on screen, show the session it came from.
    const bannerSession = moments.banner?.kind === 'point' ? sessions.find(s => s.id === (moments.banner as Extract<Banner, { kind: 'point' }>).session) : undefined;
    const shown = bannerSession ?? pool[tvIndex % pool.length];
    const Layout = vertical ? VerticalBoard : TvBoard;
    return (
      <>
        <Layout standing={standing} session={shown} matches={inSession(shown)} byId={byId} moments={moments} />
        {moments.celebration && <CelebrationOverlay c={moments.celebration} onDone={moments.dismissCelebration} />}
      </>
    );
  }

  const shown = sessions.find(s => s.id === (picked ?? current)) ?? sessions[0];

  return (
    <div className="hd-page hd-board">
      <Scoreboard standing={standing} moments={moments} />

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

      <h2 className="hd-session-title">
        {shown.day === 'fri' ? 'Friday' : 'Saturday'} · {shown.name}
        <span className="hd-muted">
          {FORMAT_NAMES[shown.format] !== shown.name && ` · ${FORMAT_NAMES[shown.format] ?? shown.format}`} · {shown.venue}
        </span>
      </h2>
      <div className="hd-rows">
        {inSession(shown).map(m => (
          <Link key={m.id} to={`/cup/match/${m.id}`} className="hd-row-link">
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

function Scoreboard({ standing, moments }: { standing: Standing; moments: Moments }) {
  const { points, projected, needed, clinched } = standing;
  return (
    <header className="hd-score">
      <Logo name="crest" className="hd-score-crest" label="Gimme House Derby" />
      <div className="hd-score-title">2026 House Derby</div>
      <div className="hd-score-row">
        {TEAMS.map(t => (
          <div key={t} className={`hd-score-team ${t}`}>
            <LeadGlow moments={moments} team={t} />
            <TeamLogo team={t} moments={moments} />
            <div className="hd-score-name">
              {TEAM_NAMES[t]}
              {t === DEFENDING_TEAM && <span className="hd-defending">Defending</span>}
            </div>
            <Points value={points[t]} className="hd-score-points" />
            <div className="hd-score-projected">Projected {fmtPoints(projected[t])}</div>
          </div>
        ))}
      </div>
      <div className="hd-score-foot">
        {clinched
          ? `${TEAM_NAMES[clinched.team]} ${clinched.how === 'wins' ? 'win the Derby' : 'retain the Derby'}`
          : `${TEAM_NAMES[DEFENDING_TEAM]} need ${fmtPoints(needed[DEFENDING_TEAM])} to retain · ${TEAM_NAMES[CHALLENGER]} need ${fmtPoints(needed[CHALLENGER])} to win`}
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
function MatchRow({ match, byId, stacked = false, flash }: {
  match: Match; byId: Map<string, Player>; stacked?: boolean; flash?: Flash;
}) {
  const states = matchStates(match);
  const { lead, started } = matchLead(states);
  const tone = lead ?? (started ? 'tied' : 'idle');
  const status = shortStatus(states) || `Match ${match.slot}`;
  // Stacked puts each player on their own line (narrow vertical layout).
  const names = (t: TeamId) => stacked
    ? sideName(match, t, byId).split(' / ').map(n => <span key={n}>{n}</span>)
    : sideName(match, t, byId);
  return (
    <div className={`hd-row lead-${tone}`}>
      <div className={`hd-row-side og ${lead === 'og' ? 'filled' : ''}`}>{names('og')}</div>
      {/* Keyed on the text so the flip replays whenever the status changes. */}
      <div className={`hd-row-status ${tone}`}><span key={status} className="hd-flip">{status}</span></div>
      <div className={`hd-row-side south ${lead === 'south' ? 'filled' : ''}`}>{names('south')}</div>
      <FlashOverlay flash={flash} />
    </div>
  );
}

/** Words under each team's score: points needed, or the clinch. */
function needLine(standing: Standing, t: TeamId, long = false): string {
  const { needed, clinched } = standing;
  if (clinched) return clinched.team === t ? (clinched.how === 'wins' ? 'Derby winners' : 'Retain the Derby') : '';
  const pts = `${fmtPoints(needed[t])}${long ? ' points' : ''}`;
  return t === DEFENDING_TEAM ? `${pts} to retain` : `${pts} to win`;
}

function bannerText(b: Banner): { title: string; detail: string; team: TeamId | null } {
  if (b.kind === 'lead') {
    return b.leader
      ? { title: `${TEAM_NAMES[b.leader]} take the lead`, detail: '', team: b.leader }
      : { title: 'All square', detail: 'The Derby is level', team: null };
  }
  const nine = b.nine ? ` · ${b.nine === 'front' ? 'Front 9' : 'Back 9'}` : '';
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

/** Full-screen crest reveal when the Derby is won or retained. Tap to dismiss. */
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
        {TEAM_NAMES[c.team]} {c.how === 'wins' ? 'win the Derby' : 'retain the Derby'}
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
function VerticalBoard({ standing, session, matches, byId, moments }: {
  standing: Standing; session: Session; matches: Match[]; byId: Map<string, Player>; moments: Moments;
}) {
  return (
    <div className="hd-page hd-vert-page">
      <div className="hd-vert">
        <div className="hd-vert-top">
          <Logo name="crest" className="hd-vert-crest" label="Gimme House Derby" />
          <span className="hd-vert-title">2026 House Derby</span>
        </div>

        <div className="hd-vert-score">
          {TEAMS.map(t => (
            <div key={t} className={`hd-vert-team ${t}`}>
              <LeadGlow moments={moments} team={t} />
              <TeamLogo team={t} moments={moments} />
              <span className="hd-vert-name">
                {TEAM_NAMES[t]}
                {/* Rendered on both sides (hidden on one) so the scores line up. */}
                <span className="hd-defending" style={t === DEFENDING_TEAM ? undefined : { visibility: 'hidden' }}>
                  Defending
                </span>
              </span>
              <Points value={standing.points[t]} className="hd-vert-points" />
              <span className="hd-vert-need">{needLine(standing, t)}</span>
            </div>
          ))}
        </div>

        <div className="hd-vert-session">
          {session.day === 'fri' ? 'Friday' : 'Saturday'} · {session.name}
        </div>

        <div className="hd-vert-rows">
          {matches.map(m => <MatchRow key={m.id} match={m} byId={byId} stacked flash={moments.flashes[m.id]} />)}
          <ResultBanner banner={moments.banner} />
        </div>

        <div className="hd-vert-foot">
          <span className="hd-foot-venue"><Logo name="ggc" className="hd-foot-logo" />{session.venue}</span>
          <span>{FORMAT_NAMES[session.format] ?? session.format}</span>
        </div>
      </div>
    </div>
  );
}

/** Full-screen broadcast layout for the clubhouse / OG House screens. */
function TvBoard({ standing, session, matches, byId, moments }: {
  standing: Standing; session: Session; matches: Match[]; byId: Map<string, Player>; moments: Moments;
}) {
  return (
    <div className="hd-page hd-tv">
      <div className="hd-tv-frame">
        <header className="hd-tv-head">
          {TEAMS.map(t => (
            <div key={t} className={`hd-tv-team ${t}`}>
              <LeadGlow moments={moments} team={t} />
              <span className="hd-tv-name">
                <TeamLogo team={t} moments={moments} />
                {TEAM_NAMES[t]}
              </span>
              <Points value={standing.points[t]} className="hd-tv-points" />
            </div>
          ))}
          <Logo name="crest" className="hd-tv-crest" label="Gimme House Derby" />
        </header>
        <div className="hd-tv-sub">
          {TEAMS.map(t => <span key={t}>{needLine(standing, t, true)}</span>)}
        </div>

        <div className="hd-tv-rows">
          {matches.map(m => {
            const states = matchStates(m);
            const { lead, started } = matchLead(states);
            const status = shortStatus(states);
            const cell = (t: TeamId) => (lead === t || (started && !lead)
              ? <span key={status} className="hd-flip">{status}</span>
              : '');
            return (
              <div key={m.id} className="hd-tv-row">
                <span className={`hd-tv-status og ${lead === 'og' ? 'filled' : ''}`}>{cell('og')}</span>
                <span className={`hd-tv-side og ${lead === 'og' ? 'filled' : ''}`}>{sideName(m, 'og', byId)}</span>
                <span className="hd-tv-slot">{m.slot}</span>
                <span className={`hd-tv-side south ${lead === 'south' ? 'filled' : ''}`}>{sideName(m, 'south', byId)}</span>
                <span className={`hd-tv-status south ${lead === 'south' ? 'filled' : ''}`}>{cell('south')}</span>
                <FlashOverlay flash={moments.flashes[m.id]} />
              </div>
            );
          })}
          <ResultBanner banner={moments.banner} />
        </div>

        <footer className="hd-tv-foot">
          <span>{session.day === 'fri' ? 'Friday' : 'Saturday'}</span>
          <span className="hd-foot-venue"><Logo name="ggc" className="hd-foot-logo" />{session.venue}</span>
          <span>{session.name}</span>
        </footer>
      </div>
    </div>
  );
}
