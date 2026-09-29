import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FORMAT_NAMES, TEAM_NAMES, currentSessionId, fmtPoints, matchLead, matchSort, shortStatus, sideName,
  useMatches, usePlayers, useSessions, type Match, type Player, type Session,
} from './data';
import { DEFENDING_TEAM, TEAMS, cupStanding, matchStates, type TeamId } from './scoring';
import './HouseDerby.css';

const TV_ROTATE_MS = 20_000;
const CHALLENGER: TeamId = DEFENDING_TEAM === 'og' ? 'south' : 'og';

type Standing = ReturnType<typeof cupStanding>;

export default function Board() {
  const [params] = useSearchParams();
  const tv = params.has('tv');
  const { sessions, error: sErr } = useSessions();
  const { matches, error: mErr } = useMatches();
  const { byId } = usePlayers();
  const [picked, setPicked] = useState<string | null>(null);
  const [tvIndex, setTvIndex] = useState(0);

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
    </div>
  );
}

function Scoreboard({ standing }: { standing: Standing }) {
  const { points, projected, needed, clinched } = standing;
  return (
    <header className="hd-score">
      <div className="hd-score-title">2026 House Derby</div>
      <div className="hd-score-row">
        {TEAMS.map(t => (
          <div key={t} className={`hd-score-team ${t}`}>
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
function MatchRow({ match, byId }: { match: Match; byId: Map<string, Player> }) {
  const states = matchStates(match);
  const { lead, started } = matchLead(states);
  const tone = lead ?? (started ? 'tied' : 'idle');
  return (
    <div className={`hd-row lead-${tone}`}>
      <div className={`hd-row-side og ${lead === 'og' ? 'filled' : ''}`}>{sideName(match, 'og', byId)}</div>
      <div className={`hd-row-status ${tone}`}>{shortStatus(states) || `Match ${match.slot}`}</div>
      <div className={`hd-row-side south ${lead === 'south' ? 'filled' : ''}`}>{sideName(match, 'south', byId)}</div>
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
              <span className="hd-tv-name">{TEAM_NAMES[t]}</span>
              <span className="hd-tv-points">{fmtPoints(points[t])}</span>
            </div>
          ))}
          <div className="hd-tv-crest">House<br />Derby</div>
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
          <span>{session.venue}</span>
          <span>{session.name}</span>
        </footer>
      </div>
    </div>
  );
}
