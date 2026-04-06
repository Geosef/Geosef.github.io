import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts';
import './PlayerDetail.css';
import type { Round, HandicapPoint, ScoringLogData, HandicapIndexData, PlayerHandicap } from '../../types/golf';
import { tagCountingRounds, groupRoundsByMonth, formatPlusMinus, formatDate } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';

const NON_MEMBER_PARTNER = 'Other (GGC Member)';

function coursesPlayed(rounds: Round[]): { course: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rounds) {
    if (r.course) map.set(r.course, (map.get(r.course) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([course, count]) => ({ course, count }))
    .sort((a, b) => b.count - a.count);
}

function playingPartners(rounds: Round[]): { partner: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rounds) {
    if (r.partner?.trim()) map.set(r.partner, (map.get(r.partner) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([partner, count]) => ({ partner, count }))
    .sort((a, b) => b.count - a.count);
}

// Keep one data point per calendar week (first entry of each week)
function weeklyHistory(history: HandicapPoint[]): HandicapPoint[] {
  const seen = new Set<number>();
  return history.filter(h => {
    const weekKey = Math.floor(new Date(h.date + 'T12:00:00').getTime() / (7 * 24 * 60 * 60 * 1000));
    if (seen.has(weekKey)) return false;
    seen.add(weekKey);
    return true;
  });
}

function HandicapChart({ history }: { history: HandicapPoint[] }) {
  const weekly = weeklyHistory(history);
  if (weekly.length === 0) return null;

  const data = weekly.map(h => ({ date: formatDate(h.date), index: h.index }));
  const indices = weekly.map(h => h.index);
  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);
  // Give y-axis a little breathing room; at least a 2-point window
  const yMin = Math.floor(minIdx - 1);
  const yMax = Math.ceil(maxIdx + 1);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fontFamily: 'sans-serif', fill: '#5a6e5a' }}
          tickLine={false}
          axisLine={{ stroke: '#c0d4c0' }}
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fontSize: 11, fontFamily: 'sans-serif', fill: '#5a6e5a' }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : v, 'Index']}
          contentStyle={{ fontFamily: 'sans-serif', fontSize: 12, borderColor: '#c0d4c0' }}
          labelStyle={{ color: '#2d4a2d', fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="index"
          stroke="#006747"
          strokeWidth={2}
          dot={{ r: 3, fill: '#006747', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#c9a84c' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function PlayerDetail() {
  const { playerName } = useParams<{ playerName: string }>();

  const [loading, setLoading] = useState(
    !sessionCache.scoringLog || !sessionCache.handicapIndex
  );
  const [error, setError] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!playerName) return;

    const fetches: Promise<void>[] = [];

    if (!sessionCache.scoringLog) {
      fetches.push(
        fetch(`${APPS_SCRIPT_URL}?action=scoringLog`)
          .then(r => r.json())
          .then((data: ScoringLogData) => { sessionCache.scoringLog = data; })
      );
    }

    if (!sessionCache.handicapIndex) {
      fetches.push(
        fetch(`${APPS_SCRIPT_URL}?action=handicapIndex`)
          .then(r => r.json())
          .then((data: HandicapIndexData) => { sessionCache.handicapIndex = data; })
      );
    }

    if (fetches.length === 0) {
      setLoading(false);
      return;
    }

    Promise.all(fetches)
      .then(() => {
        setLoading(false);
        forceUpdate(n => n + 1);
      })
      .catch(() => {
        setError('Could not load player data.');
        setLoading(false);
      });
  }, [playerName]);

  if (loading) {
    return (
      <div className="pd-wrapper">
        <div className="pd-loading">Loading…</div>
      </div>
    );
  }

  if (error || !playerName) {
    return (
      <div className="pd-wrapper">
        <Link to="/golf-leaderboard" className="pd-back">← Leaderboard</Link>
        <div className="pd-error">{error ?? 'Player not found.'}</div>
      </div>
    );
  }

  const rounds = (sessionCache.scoringLog?.rounds ?? []).filter(r => r.player === playerName);
  const handicap: PlayerHandicap | undefined = sessionCache.handicapIndex?.players.find(
    h => h.player === playerName
  );

  if (rounds.length === 0 && !handicap) {
    return (
      <div className="pd-wrapper">
        <Link to="/golf-leaderboard" className="pd-back">← Leaderboard</Link>
        <div className="pd-error">No data found for {playerName}.</div>
      </div>
    );
  }

  const tagged = tagCountingRounds(rounds);
  const groups = groupRoundsByMonth(tagged);
  const courses = coursesPlayed(tagged);
  const partners = playingPartners(tagged);

  return (
    <div className="pd-wrapper">
      <div className="pd-header">
        <Link to="/golf-leaderboard" className="pd-back">← Leaderboard</Link>
        <h1 className="pd-name">{playerName}</h1>
        {handicap?.current != null && (
          <p className="pd-hcp-current">Handicap Index: {handicap.current.toFixed(1)}</p>
        )}
      </div>

      <div className="pd-content">

        {/* Round History */}
        <section className="pd-section">
          <h2 className="pd-section-title">Round History</h2>
          {groups.length === 0 && <p className="pd-empty">No rounds recorded.</p>}
          {groups.map(({ month, rounds: monthRounds, monthlyCount }) => {
            const countingCount = monthRounds.filter(r => r.counts).length;
            return (
              <div key={month} className="pd-month-group">
                <div className="pd-month-header">
                  {month}
                  <span className="pd-month-meta">
                    · {countingCount} of {monthlyCount} round{monthlyCount !== 1 ? 's' : ''} count
                  </span>
                </div>
                {monthRounds.map((r, i) => (
                  <div key={i} className={`pd-round-row ${r.counts ? 'pd-round-counting' : 'pd-round-other'}`}>
                    <span className="pd-round-check">{r.counts ? '✓' : '·'}</span>
                    <span className="pd-round-date">{formatDate(r.datePlayed)}</span>
                    <span className="pd-round-course">
                      {r.course}{r.tees ? ` (${r.tees})` : ''}
                    </span>
                    <span className="pd-round-scores">
                      {r.score} / {r.netScore} ({formatPlusMinus(r.plusMinus)})
                    </span>
                    <span className="pd-round-hcp">HCP {r.playingHandicap}</span>
                    {r.partner && <span className="pd-round-partner">w/ {r.partner}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </section>

        {/* Handicap History */}
        {handicap && handicap.history.length > 0 && (
          <section className="pd-section">
            <h2 className="pd-section-title">Handicap History</h2>
            <div className="pd-hcp-chart">
              <HandicapChart history={handicap.history} />
            </div>
          </section>
        )}

        {/* Courses Played */}
        {courses.length > 0 && (
          <section className="pd-section">
            <h2 className="pd-section-title">Courses Played</h2>
            {courses.map(({ course, count }) => (
              <div key={course} className="pd-stat-row">
                <span className="pd-stat-name">{course}</span>
                <span className="pd-stat-count">{count} round{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </section>
        )}

        {/* Playing Partners */}
        {partners.length > 0 && (
          <section className="pd-section">
            <h2 className="pd-section-title">Playing Partners</h2>
            {partners.map(({ partner, count }) => (
              <div key={partner} className="pd-stat-row">
                {partner === NON_MEMBER_PARTNER ? (
                  <span className="pd-stat-name">{partner}</span>
                ) : (
                  <Link
                    to={`/golf-leaderboard/player/${encodeURIComponent(partner)}`}
                    className="pd-stat-link"
                  >
                    {partner}
                  </Link>
                )}
                <span className="pd-stat-count">{count} round{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </section>
        )}

      </div>
    </div>
  );
}
