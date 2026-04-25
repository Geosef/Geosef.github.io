import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import FavoriteStar from '../../components/FavoriteStar';
import { useUserPrefs } from '../../hooks/useUserPrefs';
import { SkeletonDetailHeader, SkeletonSection } from './GolfSkeleton';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts';
import './GolfLeaderboard.css';
import './PlayerDetail.css';
import type { Round, HandicapPoint, ScoringLogData, HandicapIndexData, PlayerHandicap } from '../../types/golf';
import { tagCountingRounds, groupRoundsByMonth, formatDate } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';
import { RoundMonthGroup } from './RoundHistory';
import { countBy, NON_MEMBER_PARTNER } from './leaderboard-utils';

// Fixed weekly pull dates for the full 2026 season (Tuesdays, 3/31 – 8/25)
const SEASON_WEEKS = [
  '2026-03-31','2026-04-07','2026-04-14','2026-04-21','2026-04-28',
  '2026-05-05','2026-05-12','2026-05-19','2026-05-26',
  '2026-06-02','2026-06-09','2026-06-16','2026-06-23','2026-06-30',
  '2026-07-07','2026-07-14','2026-07-21','2026-07-28',
  '2026-08-04','2026-08-11','2026-08-18','2026-08-25',
];


// The sheet's base date cell uses an old year (e.g. 2025 instead of 2026).
// Match on MM-DD only so year mismatches don't break the lookup.
function toMD(dateStr: string): string {
  const iso = dateStr.match(/^\d{4}-(\d{2}-\d{2})/);
  if (iso) return iso[1];
  const slash = dateStr.match(/^(\d{1,2})\/(\d{1,2})/);
  if (slash) return `${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  return dateStr;
}

function HandicapChart({ history }: { history: HandicapPoint[] }) {
  if (history.length === 0) return null;

  const byMD = new Map(history.map(h => [toMD(h.date), h.index]));
  const data = SEASON_WEEKS.map(d => ({
    date: formatDate(d),
    index: byMD.get(d.slice(5)) ?? null, // SEASON_WEEKS are "YYYY-MM-DD", slice to "MM-DD"
  }));

  const knownValues = data.flatMap(d => d.index !== null ? [d.index] : []);
  if (knownValues.length === 0) return null;

  const minIdx = Math.min(...knownValues);
  const maxIdx = Math.max(...knownValues);
  const yMin = Math.floor(minIdx - 1);
  const yMax = Math.ceil(maxIdx + 1);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fontFamily: 'sans-serif', fill: '#5a6e5a' }}
          tickLine={false}
          axisLine={{ stroke: '#c0d4c0' }}
          interval={3}
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fontSize: 11, fontFamily: 'sans-serif', fill: '#5a6e5a' }}
          tickLine={false}
          axisLine={false}
          width={40}
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
          activeDot={{ r: 5, fill: '#fce300' }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function PlayerDetail() {
  const { playerName } = useParams<{ playerName: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { prefs, toggleFavoritePlayer } = useUserPrefs();

  // Go back in history if we have it; fall back to leaderboard for direct-URL visits
  function goBack() {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/golf-leaderboard');
    }
  }

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
      <div className="gl-detail-wrapper">
        <SkeletonDetailHeader />
        <div className="gl-detail-content">
          <SkeletonSection />
          <SkeletonSection />
        </div>
      </div>
    );
  }

  if (error || !playerName) {
    return (
      <div className="gl-detail-wrapper">
        <button onClick={goBack} className="gl-detail-back"><ArrowLeft size={16} /> Back</button>
        <div className="gl-detail-error">{error ?? 'Player not found.'}</div>
      </div>
    );
  }

  const rounds = (sessionCache.scoringLog?.rounds ?? []).filter(r => r.player === playerName);
  const handicap: PlayerHandicap | undefined = sessionCache.handicapIndex?.players.find(
    h => h.player === playerName
  );

  const tagged = tagCountingRounds(rounds);
  const groups = groupRoundsByMonth(tagged);
  const courses = countBy(tagged, r => r.course);
  const partners = countBy(tagged, r => r.partner?.trim() || null);

  return (
    <div className="gl-detail-wrapper">
      <div className="gl-detail-header">
        <button onClick={goBack} className="gl-detail-back"><ArrowLeft size={16} /> Back</button>
        <div className="gl-detail-title-row">
          <h1 className="pd-name">{playerName}</h1>
          {prefs && (
            <FavoriteStar
              isFavorite={prefs.favoritePlayers.includes(playerName)}
              onToggle={() => toggleFavoritePlayer(playerName)}
              label={playerName}
            />
          )}
        </div>
        {handicap?.current != null && (
          <p className="pd-hcp-current">Handicap Index: {handicap.current.toFixed(1)}</p>
        )}
      </div>

      <div className="gl-detail-content">

        {/* Round History */}
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Round History</h2>
          {groups.length === 0 && <p className="gl-detail-empty">No rounds recorded.</p>}
          {groups.map(({ month, rounds: monthRounds, monthlyCount }) => (
            <RoundMonthGroup key={month} month={month} rounds={monthRounds} monthlyCount={monthlyCount} />
          ))}
        </section>

        {/* Handicap History */}
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Handicap History</h2>
          {handicap && handicap.history.length > 0 ? (
            <div className="pd-hcp-chart">
              <HandicapChart history={handicap.history} />
            </div>
          ) : (
            <p className="gl-detail-empty">No handicap data available.</p>
          )}
        </section>

        {/* Courses Played */}
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Courses Played</h2>
          {courses.length > 0 ? (
            courses.map(({ value: course, count }) => (
              <div key={course} className="gl-stat-row">
                <Link
                  to={`/golf-leaderboard/course/${encodeURIComponent(course)}`}
                  className="gl-stat-link"
                >
                  {course}
                </Link>
                <span className="gl-stat-count">{count} round{count !== 1 ? 's' : ''}</span>
              </div>
            ))
          ) : (
            <p className="gl-detail-empty">No courses recorded.</p>
          )}
        </section>

        {/* Playing Partners */}
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Playing Partners</h2>
          {partners.length > 0 ? (
            partners.map(({ value: partner, count }) => (
              <div key={partner} className="gl-stat-row">
                {partner === NON_MEMBER_PARTNER ? (
                  <span className="gl-stat-name">{partner}</span>
                ) : (
                  <Link
                    to={`/golf-leaderboard/player/${encodeURIComponent(partner)}`}
                    className="gl-stat-link"
                  >
                    {partner}
                  </Link>
                )}
                <span className="gl-stat-count">{count} round{count !== 1 ? 's' : ''}</span>
              </div>
            ))
          ) : (
            <p className="gl-detail-empty">No playing partners recorded.</p>
          )}
        </section>

      </div>
    </div>
  );
}
