import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FORMAT_NAMES, TEAM_NAMES, currentSessionId, fmtPoints, matchSort, sideName, statusLabel,
  useMatches, usePlayers, useSessions, type Match, type Player, type Session,
} from './data';
import { DEFENDING_TEAM, TEAMS, cupStanding, matchStates, type TeamId } from './scoring';
import './HouseDerby.css';

const TV_ROTATE_MS = 20_000;

export default function Board() {
  const [params] = useSearchParams();
  const tv = params.has('tv');
  const { sessions, error: sErr } = useSessions();
  const { matches, error: mErr } = useMatches();
  const { byId } = usePlayers();
  const [picked, setPicked] = useState<string | null>(null);
  const [tvIndex, setTvIndex] = useState(0);

  // TV: cycle through sessions that have started, unless only one is live.
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

  let shownId = picked ?? current;
  if (tv) {
    const started = sessions.filter(s => sorted.some(m => m.session === s.id && matchStates(m).some(st => st.phase !== 'not-started')));
    const live = started.filter(s => sorted.some(m => m.session === s.id && matchStates(m).some(st => st.phase === 'live')));
    const pool = live.length === 1 ? live : started.length ? started : sessions;
    shownId = pool[tvIndex % pool.length]?.id;
  }
  const shown = sessions.find(s => s.id === shownId) ?? sessions[0];

  return (
    <div className={`hd-page hd-board ${tv ? 'hd-tv' : ''}`}>
      <Scoreboard standing={standing} />

      {!tv && (
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
      )}

      <SessionMatches session={shown} matches={sorted.filter(m => m.session === shown.id)} byId={byId} tv={tv} />
    </div>
  );
}

function Scoreboard({ standing }: { standing: ReturnType<typeof cupStanding> }) {
  const { points, projected, needed, clinched } = standing;
  const challenger: TeamId = DEFENDING_TEAM === 'og' ? 'south' : 'og';
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
          : `${TEAM_NAMES[DEFENDING_TEAM]} need ${fmtPoints(needed[DEFENDING_TEAM])} to retain · ${TEAM_NAMES[challenger]} need ${fmtPoints(needed[challenger])} to win`}
      </div>
    </header>
  );
}

function SessionMatches({ session, matches, byId, tv }: {
  session: Session; matches: Match[]; byId: Map<string, Player>; tv: boolean;
}) {
  return (
    <section>
      <h2 className="hd-session-title">
        {session.day === 'fri' ? 'Friday' : 'Saturday'} · {session.name}
        <span className="hd-muted">
          {FORMAT_NAMES[session.format] !== session.name && ` · ${FORMAT_NAMES[session.format] ?? session.format}`} · {session.venue}
        </span>
      </h2>
      <div className="hd-cards">
        {matches.map(m => {
          const card = <MatchCard match={m} byId={byId} />;
          return tv
            ? <div key={m.id} className="hd-card">{card}</div>
            : <Link key={m.id} to={`/cup/match/${m.id}`} className="hd-card">{card}</Link>;
        })}
      </div>
    </section>
  );
}

function MatchCard({ match, byId }: { match: Match; byId: Map<string, Player> }) {
  const states = matchStates(match);
  const current = states.find(s => s.phase === 'live')
    ?? [...states].reverse().find(s => s.phase === 'final')
    ?? states[0];
  const lead = current.phase === 'final' ? current.winner : current.leader;
  return (
    <>
      <div className={`hd-card-side og ${lead === 'og' ? 'leading' : ''}`}>{sideName(match, 'og', byId)}</div>
      <div className={`hd-card-status ${lead ?? 'even'} ${current.phase}`}>
        {current.phase === 'final' && states.length === 1 && !current.winner ? 'Halved' : statusLabel(states)}
      </div>
      <div className={`hd-card-side south ${lead === 'south' ? 'leading' : ''}`}>{sideName(match, 'south', byId)}</div>
    </>
  );
}
