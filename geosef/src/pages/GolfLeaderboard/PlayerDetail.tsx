import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import './PlayerDetail.css';
import type { PlayerDetailData, Round, HandicapPoint } from '../../types/golf';
import { tagCountingRounds, groupRoundsByMonth, formatPlusMinus, formatDate } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';

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

function currentHandicap(history: HandicapPoint[]): number | null {
  return history.length > 0 ? history[history.length - 1].index : null;
}

export default function PlayerDetail() {
  const { playerName } = useParams<{ playerName: string }>();
  const [detail, setDetail] = useState<PlayerDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerName) return;

    const cached = sessionCache.players.get(playerName);
    if (cached) {
      setDetail(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`${APPS_SCRIPT_URL}?action=playerDetail&name=${encodeURIComponent(playerName)}`)
      .then(r => r.json())
      .then((data: PlayerDetailData) => {
        sessionCache.players.set(playerName, data);
        setDetail(data);
        setLoading(false);
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

  if (error || !detail) {
    return (
      <div className="pd-wrapper">
        <Link to="/golf-leaderboard" className="pd-back">← Leaderboard</Link>
        <div className="pd-error">{error ?? 'Player not found.'}</div>
      </div>
    );
  }

  const tagged = tagCountingRounds(detail.rounds);
  const groups = groupRoundsByMonth(tagged);
  const courses = coursesPlayed(tagged);
  const partners = playingPartners(tagged);
  const hcp = currentHandicap(detail.handicapHistory);

  return (
    <div className="pd-wrapper">
      <div className="pd-header">
        <Link to="/golf-leaderboard" className="pd-back">← Leaderboard</Link>
        <h1 className="pd-name">{detail.player}</h1>
        {hcp !== null && (
          <p className="pd-hcp-current">Handicap Index: {hcp.toFixed(1)}</p>
        )}
      </div>

      <div className="pd-content">

        {/* Round History */}
        <section className="pd-section">
          <h2 className="pd-section-title">Round History</h2>
          {groups.length === 0 && <p className="pd-empty">No rounds recorded.</p>}
          {groups.map(({ month, rounds, monthlyCount }) => {
            const countingCount = rounds.filter(r => r.counts).length;
            return (
              <div key={month} className="pd-month-group">
                <div className="pd-month-header">
                  {month}
                  <span className="pd-month-meta">
                    · {countingCount} of {monthlyCount} round{monthlyCount !== 1 ? 's' : ''} count
                  </span>
                </div>
                {rounds.map((r, i) => (
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
        {detail.handicapHistory.length > 0 && (
          <section className="pd-section">
            <h2 className="pd-section-title">Handicap History</h2>
            <div className="pd-hcp-list">
              {[...detail.handicapHistory].reverse().map((h, i) => (
                <div key={i} className="pd-hcp-row">
                  <span className="pd-hcp-date">{formatDate(h.date)}</span>
                  <span className="pd-hcp-val">{h.index.toFixed(1)}</span>
                </div>
              ))}
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
                <span className="pd-stat-name">{partner}</span>
                <span className="pd-stat-count">{count} round{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </section>
        )}

      </div>
    </div>
  );
}
