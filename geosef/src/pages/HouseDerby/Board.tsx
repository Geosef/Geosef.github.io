import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  TEAM_NAMES, currentSessionId, dayAndSession, fmtPoints, formatLabel, matchLead, matchName, matchSort, nineName, shortStatus, sideName, thruLabel,
  useMatches, usePlayers, useSessions, type Match, type Player, type Session,
} from './data';
import { TEAMS, cupStanding, matchStates, type HoleOutcome, type TeamId } from './scoring';
import { useCupChrome } from './brand';
import Logo from './Logo';
import { useCountUp, useScoreMoments, type Banner, type Celebration } from './useScoreMoments';
import './HouseDerby.css';


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
  const moments = useScoreMoments(matches);
  useCupChrome();

  const error = sErr ?? mErr;
  if (error) return <div className="hd-page"><p className="hd-error">{error}</p></div>;
  if (!sessions || !matches) return <div className="hd-page"><p className="hd-muted">Loading…</p></div>;

  const standing = cupStanding(matches);
  const sorted = [...matches].sort(matchSort(sessions));
  const current = currentSessionId(sessions, matches);
  const inSession = (s: Session) => sorted.filter(m => m.session === s.id);

  if (tv) {
    // Stages are played one at a time, so the TV holds on the current one (same
    // rule as the phone board's default tab) rather than rotating. While a
    // match result banner is up, it shows the session that result came from.
    const bannerSession = moments.banner?.kind === 'point' ? sessions.find(s => s.id === (moments.banner as Extract<Banner, { kind: 'point' }>).session) : undefined;
    const shown = bannerSession ?? sessions.find(s => s.id === current) ?? sessions[0];
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

      <h2 className="hd-session-title">
        {dayAndSession(shown)}
        <span className="hd-muted"> · {formatLabel(shown)} · {shown.venue}</span>
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
function MatchRow({ match, byId, stacked = false, flash }: {
  match: Match; byId: Map<string, Player>; stacked?: boolean; flash?: Flash;
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
    <div className={`hd-row lead-${tone}`}>
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
function VerticalBoard({ standing, session, matches, byId, moments }: {
  standing: Standing; session: Session; matches: Match[]; byId: Map<string, Player>; moments: Moments;
}) {
  return (
    <div className="hd-page hd-vert-page">
      <div className="hd-vert">
        <TeamHeader standing={standing} moments={moments} variant="vert" />

        <div className="hd-vert-session">{dayAndSession(session)}</div>

        <div className="hd-vert-rows">
          {/* One name per line fits up to 6 rows; Friday's 12 nines need one line per side. */}
          {matches.map(m => (
            <MatchRow key={m.id} match={m} byId={byId} stacked={matches.length <= 6} flash={moments.flashes[m.id]} />
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
function TvBoard({ standing, session, matches, byId, moments }: {
  standing: Standing; session: Session; matches: Match[]; byId: Map<string, Player>; moments: Moments;
}) {
  return (
    <div className="hd-page hd-tv">
      <div className="hd-tv-frame">
        <TeamHeader standing={standing} moments={moments} variant="tv" />

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
