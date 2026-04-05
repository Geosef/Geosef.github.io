import React, { useEffect, useState, useCallback } from 'react';
import './GolfLeaderboard.css';

const APPS_SCRIPT_URL = ''; // TODO: paste your deployed Apps Script URL here
const POLL_INTERVAL_MS = 60_000;

interface Standing {
  rank: number;
  name: string;
  points: number;
  rounds: number;
  isTied: boolean;
}

interface LeaderboardData {
  standings: Standing[];
  lastUpdated: string;
}

function formatRank(standing: Standing): string {
  return standing.isTied ? `T${standing.rank}` : `${standing.rank}`;
}

function formatPoints(points: number): string {
  return points.toFixed(2);
}

export default function GolfLeaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    if (!APPS_SCRIPT_URL) return;
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=leaderboard`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: LeaderboardData = await res.json();
      setData(json);
      setError(null);
      setIsLive(true);
      setTimeout(() => setIsLive(false), 3000);
    } catch (e) {
      setError('Could not load leaderboard. Will retry.');
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return (
    <div className="gl-wrapper">
      <div className="gl-header">
        <div className="gl-header-top">
          <span className="gl-flag">⛳</span>
          <div>
            <h1 className="gl-title">GGC Outdoor League</h1>
            <p className="gl-subtitle">2026 Season Standings</p>
          </div>
          <span className="gl-flag">⛳</span>
        </div>
        <div className="gl-meta">
          {isLive && <span className="gl-live-badge">● LIVE</span>}
          {data?.lastUpdated && (
            <span className="gl-updated">Updated {data.lastUpdated}</span>
          )}
        </div>
      </div>

      <div className="gl-content">
        {!APPS_SCRIPT_URL && (
          <div className="gl-notice">
            Apps Script URL not configured. Add it to <code>GolfLeaderboard.tsx</code>.
          </div>
        )}

        {error && <div className="gl-error">{error}</div>}

        {data && (
          <table className="gl-table">
            <thead>
              <tr>
                <th className="gl-col-rank">POS</th>
                <th className="gl-col-name">PLAYER</th>
                <th className="gl-col-rounds">RDS</th>
                <th className="gl-col-points">PTS</th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map((s, i) => (
                <tr
                  key={s.name}
                  className={`gl-row ${i === 0 ? 'gl-row-leader' : ''} ${i % 2 === 0 ? 'gl-row-even' : ''}`}
                >
                  <td className="gl-col-rank">{formatRank(s)}</td>
                  <td className="gl-col-name">{s.name}</td>
                  <td className="gl-col-rounds">{s.rounds}</td>
                  <td className="gl-col-points">{formatPoints(s.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!data && !error && APPS_SCRIPT_URL && (
          <div className="gl-loading">Loading standings…</div>
        )}
      </div>
    </div>
  );
}
