import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FORMAT_NAMES, TEAM_NAMES, currentSessionId, fmtPoints, matchLead, matchSort, shortStatus, sideName,
  useMatches, usePlayers, useSessions, type Match, type Player, type Session,
} from './data';
import { DEFENDING_TEAM, TEAMS, cupStanding, matchStates, type TeamId } from './scoring';
import { LOGOS, useCupChrome } from './brand';
import './HouseDerby.css';

const TV_ROTATE_MS = 20_000;
const CHALLENGER: TeamId = DEFENDING_TEAM === 'og' ? 'south' : 'og';

type Standing = ReturnType<typeof cupStanding>;

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
    const shown = pool[tvIndex % pool.length];
    if (vertical) {
      return <VerticalBoard standing={standing} session={shown} matches={inSession(shown)} byId={byId} />;
    }
    return <TvBoard standing={standing} session={shown} matches={inSession(shown)} byId={byId} />;
  }

  const shown = sessions.find(s => s.id === (picked ?? current)) ?? sessions[0];

  return (
    <div className="hd-page hd-board">
      <Scoreboard standing={standing} />

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
            <MatchRow match={m} byId={byId} />
          </Link>
        ))}
      </div>
      <footer className="hd-board-foot">
        <img src={LOGOS.ggc} alt="" />
        <span>Gimme Golf Club</span>
      </footer>
    </div>
  );
}

function Scoreboard({ standing }: { standing: Standing }) {
  const { points, projected, needed, clinched } = standing;
  return (
    <header className="hd-score">
      <img className="hd-score-crest" src={LOGOS.crest} alt="Gimme House Derby" />
      <div className="hd-score-title">2026 House Derby</div>
      <div className="hd-score-row">
        {TEAMS.map(t => (
          <div key={t} className={`hd-score-team ${t}`}>
            <img className="hd-team-logo" src={LOGOS.team[t]} alt="" />
            <div className="hd-score-name">
              {TEAM_NAMES[t]}
              {t === DEFENDING_TEAM && <span className="hd-defending">Defending</span>}
            </div>
            <div className="hd-score-points">{fmtPoints(points[t])}</div>
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

/**
 * Leaderboard row in the Golf Genius style: the leading side's cell fills with
 * its team color and the status arrow points toward it.
 */
function MatchRow({ match, byId, stacked = false }: { match: Match; byId: Map<string, Player>; stacked?: boolean }) {
  const states = matchStates(match);
  const { lead, started } = matchLead(states);
  const tone = lead ?? (started ? 'tied' : 'idle');
  // Stacked puts each player on their own line (narrow vertical layout).
  const names = (t: TeamId) => stacked
    ? sideName(match, t, byId).split(' / ').map(n => <span key={n}>{n}</span>)
    : sideName(match, t, byId);
  return (
    <div className={`hd-row lead-${tone}`}>
      <div className={`hd-row-side og ${lead === 'og' ? 'filled' : ''}`}>{names('og')}</div>
      <div className={`hd-row-status ${tone}`}>{shortStatus(states) || `Match ${match.slot}`}</div>
      <div className={`hd-row-side south ${lead === 'south' ? 'filled' : ''}`}>{names('south')}</div>
    </div>
  );
}

/** Words under each team's score: points needed, or the clinch. */
function needLine(standing: Standing, t: TeamId): string {
  const { needed, clinched } = standing;
  if (clinched) return clinched.team === t ? (clinched.how === 'wins' ? 'Derby winners' : 'Retain the Derby') : '';
  return t === DEFENDING_TEAM ? `${fmtPoints(needed[t])} to retain` : `${fmtPoints(needed[t])} to win`;
}

/**
 * 9:16 board for Instagram Live. Instagram overlays the account/viewer count
 * across the top and comments across the bottom, so those bands only carry
 * the title and footer; scores and matches sit in the middle.
 */
function VerticalBoard({ standing, session, matches, byId }: {
  standing: Standing; session: Session; matches: Match[]; byId: Map<string, Player>;
}) {
  return (
    <div className="hd-page hd-vert-page">
      <div className="hd-vert">
        <div className="hd-vert-top">
          <img className="hd-vert-crest" src={LOGOS.crest} alt="Gimme House Derby" />
          <span className="hd-vert-title">2026 House Derby</span>
        </div>

        <div className="hd-vert-score">
          {TEAMS.map(t => (
            <div key={t} className={`hd-vert-team ${t}`}>
              <img className="hd-team-logo" src={LOGOS.team[t]} alt="" />
              <span className="hd-vert-name">
                {TEAM_NAMES[t]}
                {/* Rendered on both sides (hidden on one) so the scores line up. */}
                <span className="hd-defending" style={t === DEFENDING_TEAM ? undefined : { visibility: 'hidden' }}>
                  Defending
                </span>
              </span>
              <span className="hd-vert-points">{fmtPoints(standing.points[t])}</span>
              <span className="hd-vert-need">{needLine(standing, t)}</span>
            </div>
          ))}
        </div>

        <div className="hd-vert-session">
          {session.day === 'fri' ? 'Friday' : 'Saturday'} · {session.name}
        </div>

        <div className="hd-vert-rows">
          {matches.map(m => <MatchRow key={m.id} match={m} byId={byId} stacked />)}
        </div>

        <div className="hd-vert-foot">
          <span className="hd-foot-venue"><img src={LOGOS.ggc} alt="" />{session.venue}</span>
          <span>{FORMAT_NAMES[session.format] ?? session.format}</span>
        </div>
      </div>
    </div>
  );
}

/** Full-screen broadcast layout for the clubhouse / OG House screens. */
function TvBoard({ standing, session, matches, byId }: {
  standing: Standing; session: Session; matches: Match[]; byId: Map<string, Player>;
}) {
  const { points, needed, clinched } = standing;
  const sub = (t: TeamId) => {
    if (clinched) return clinched.team === t ? (clinched.how === 'wins' ? 'Derby winners' : 'Retain the Derby') : '';
    return t === DEFENDING_TEAM ? `${fmtPoints(needed[t])} points to retain` : `${fmtPoints(needed[t])} points to win`;
  };
  return (
    <div className="hd-page hd-tv">
      <div className="hd-tv-frame">
        <header className="hd-tv-head">
          {TEAMS.map(t => (
            <div key={t} className={`hd-tv-team ${t}`}>
              <span className="hd-tv-name">
                <img className="hd-team-logo" src={LOGOS.team[t]} alt="" />
                {TEAM_NAMES[t]}
              </span>
              <span className="hd-tv-points">{fmtPoints(points[t])}</span>
            </div>
          ))}
          <img className="hd-tv-crest" src={LOGOS.crest} alt="Gimme House Derby" />
        </header>
        <div className="hd-tv-sub">
          {TEAMS.map(t => <span key={t}>{sub(t)}</span>)}
        </div>

        <div className="hd-tv-rows">
          {matches.map(m => {
            const states = matchStates(m);
            const { lead, started } = matchLead(states);
            const status = shortStatus(states);
            return (
              <div key={m.id} className="hd-tv-row">
                <span className={`hd-tv-status og ${lead === 'og' ? 'filled' : ''}`}>
                  {lead === 'og' || (started && !lead) ? status : ''}
                </span>
                <span className={`hd-tv-side og ${lead === 'og' ? 'filled' : ''}`}>{sideName(m, 'og', byId)}</span>
                <span className="hd-tv-slot">{m.slot}</span>
                <span className={`hd-tv-side south ${lead === 'south' ? 'filled' : ''}`}>{sideName(m, 'south', byId)}</span>
                <span className={`hd-tv-status south ${lead === 'south' ? 'filled' : ''}`}>
                  {lead === 'south' || (started && !lead) ? status : ''}
                </span>
              </div>
            );
          })}
        </div>

        <footer className="hd-tv-foot">
          <span>{session.day === 'fri' ? 'Friday' : 'Saturday'}</span>
          <span className="hd-foot-venue"><img src={LOGOS.ggc} alt="" />{session.venue}</span>
          <span>{session.name}</span>
        </footer>
      </div>
    </div>
  );
}
