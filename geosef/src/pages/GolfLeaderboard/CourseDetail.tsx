import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import './GolfLeaderboard.css';
import './CourseDetail.css';
import type { Round, ScoringLogData } from '../../types/golf';
import { formatPlusMinus, formatDate } from '../../types/golf';

function pmScoreClass(pm: number): string {
  return pm < 0 ? 'gl-score-under' : 'gl-score-even';
}
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';

function topRoundsByGross(rounds: Round[], n = 3): Round[] {
  return [...rounds].sort((a, b) => a.score - b.score).slice(0, n);
}

function topRoundsByNet(rounds: Round[], n = 3): Round[] {
  return [...rounds].sort((a, b) => a.netScore - b.netScore).slice(0, n);
}

function frequentPlayers(rounds: Round[]): { player: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rounds) {
    map.set(r.player, (map.get(r.player) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([player, count]) => ({ player, count }))
    .sort((a, b) => b.count - a.count);
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function CourseDetail() {
  const { courseName } = useParams<{ courseName: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  function goBack() {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/golf-leaderboard');
    }
  }

  const [loading, setLoading] = useState(!sessionCache.scoringLog);
  const [error, setError] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!courseName) return;
    if (sessionCache.scoringLog) {
      setLoading(false);
      return;
    }

    fetch(`${APPS_SCRIPT_URL}?action=scoringLog`)
      .then(r => r.json())
      .then((data: ScoringLogData) => {
        sessionCache.scoringLog = data;
        setLoading(false);
        forceUpdate(n => n + 1);
      })
      .catch(() => {
        setError('Could not load course data.');
        setLoading(false);
      });
  }, [courseName]);

  if (loading) {
    return (
      <div className="cd-wrapper">
        <div className="cd-loading">Loading…</div>
      </div>
    );
  }

  if (error || !courseName) {
    return (
      <div className="cd-wrapper">
        <button onClick={goBack} className="cd-back">← Back</button>
        <div className="cd-error">{error ?? 'Course not found.'}</div>
      </div>
    );
  }

  const decoded = decodeURIComponent(courseName);
  const rounds = (sessionCache.scoringLog?.rounds ?? []).filter(r => r.course === decoded);

  if (rounds.length === 0) {
    return (
      <div className="cd-wrapper">
        <button onClick={goBack} className="cd-back">← Back</button>
        <div className="cd-error">No rounds found for {decoded}.</div>
      </div>
    );
  }

  const grossTop = topRoundsByGross(rounds);
  const netTop = topRoundsByNet(rounds);
  const players = frequentPlayers(rounds);
  const history = [...rounds].sort(
    (a, b) => new Date(b.datePlayed).getTime() - new Date(a.datePlayed).getTime()
  );

  // Unique tees played at this course
  const teesSet = new Set(rounds.map(r => r.tees).filter(Boolean));
  const par = rounds[0]?.coursePar;

  return (
    <div className="cd-wrapper">
      <div className="cd-header">
        <button onClick={goBack} className="cd-back">← Back</button>
        <h1 className="cd-name">{decoded}</h1>
        <p className="cd-meta">
          Par {par} · {rounds.length} round{rounds.length !== 1 ? 's' : ''}
          {teesSet.size > 0 && ` · ${[...teesSet].join(', ')} tees`}
        </p>
      </div>

      <div className="cd-content">

        {/* Notable Rounds */}
        <section className="cd-section">
          <h2 className="cd-section-title">Notable Rounds</h2>
          <div className="cd-notable-grid">
            <div className="cd-notable-col">
              <div className="cd-notable-label">Low Gross</div>
              {grossTop.map((r, i) => (
                <div key={i} className="cd-notable-row">
                  <span className="cd-notable-medal">{MEDALS[i]}</span>
                  <span className="cd-notable-info">
                    <Link
                      to={`/golf-leaderboard/player/${encodeURIComponent(r.player)}`}
                      className="cd-player-link"
                    >
                      {r.player}
                    </Link>
                    <span className="cd-notable-date">{formatDate(r.datePlayed)}</span>
                  </span>
                  <span className={`cd-notable-score ${pmScoreClass(r.plusMinus)}`}>
                    {r.score} ({formatPlusMinus(r.plusMinus)})
                  </span>
                </div>
              ))}
            </div>
            <div className="cd-notable-col">
              <div className="cd-notable-label">Low Net</div>
              {netTop.map((r, i) => (
                <div key={i} className="cd-notable-row">
                  <span className="cd-notable-medal">{MEDALS[i]}</span>
                  <span className="cd-notable-info">
                    <Link
                      to={`/golf-leaderboard/player/${encodeURIComponent(r.player)}`}
                      className="cd-player-link"
                    >
                      {r.player}
                    </Link>
                    <span className="cd-notable-date">{formatDate(r.datePlayed)}</span>
                  </span>
                  <span className={`cd-notable-score ${pmScoreClass(r.plusMinus)}`}>
                    {r.netScore} net ({formatPlusMinus(r.plusMinus)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Frequent Players */}
        <section className="cd-section">
          <h2 className="cd-section-title">Frequent Players</h2>
          {players.map(({ player, count }) => (
            <div key={player} className="cd-stat-row">
              <Link
                to={`/golf-leaderboard/player/${encodeURIComponent(player)}`}
                className="cd-stat-link"
              >
                {player}
              </Link>
              <span className="cd-stat-count">{count} round{count !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </section>

        {/* Round History */}
        <section className="cd-section">
          <h2 className="cd-section-title">Round History</h2>
          {history.map((r, i) => (
            <div key={i} className="cd-round-row">
              <span className="cd-round-date">{formatDate(r.datePlayed)}</span>
              <Link
                to={`/golf-leaderboard/player/${encodeURIComponent(r.player)}`}
                className="cd-player-link cd-round-player"
              >
                {r.player}
              </Link>
              {r.tees && <span className="cd-round-tees">{r.tees}</span>}
              <span className={`cd-round-scores ${pmScoreClass(r.plusMinus)}`}>
                {r.score} / {r.netScore} ({formatPlusMinus(r.plusMinus)})
              </span>
              <span className="cd-round-hcp">HCP {r.playingHandicap}</span>
            </div>
          ))}
        </section>

      </div>
    </div>
  );
}
