import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './GolfLeaderboard.css';
import type { LeaderboardData } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';
import { SortTh, sortStandings, SortDir, SearchInput } from './leaderboard-utils';
import { SkeletonTableRows } from './GolfSkeleton';

export default function PlayersList() {
  const navigate = useNavigate();
  const [data, setData] = useState<LeaderboardData | null>(sessionCache.season);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    if (sessionCache.season) return;
    fetch(`${APPS_SCRIPT_URL}?action=leaderboard`)
      .then(r => r.json())
      .then((d: LeaderboardData) => {
        sessionCache.season = d;
        setData(d);
      })
      .catch(() => {});
  }, []);

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'points' ? 'desc' : 'asc');
    }
  }

  const standings = data?.standings ?? [];
  const filtered = searchQuery.trim()
    ? standings.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : standings;
  const display = sortStandings(filtered, sortKey, sortDir, 'season');

  return (
    <div className="gl-wrapper">
      <div className="gl-header gl-header--with-search">
        <h1 className="gl-title">All Players</h1>
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Filter players…" />
      </div>

      <div className="gl-content">
        <table className="gl-table">
          <thead>
            <tr>
              <SortTh label="Pos" sortK="rank" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="gl-col-rank" invertArrow />
              <SortTh label="Player" sortK="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="gl-col-name" />
              <SortTh label="Points" sortK="points" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="gl-col-points" />
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <SkeletonTableRows rows={8} cols={3} />
            ) : (
              display.map((s, i) => (
                <tr
                  key={s.name}
                  className={['gl-row', i % 2 === 0 ? 'gl-row-even' : ''].filter(Boolean).join(' ')}
                  onClick={() => navigate(`/golf-leaderboard/player/${encodeURIComponent(s.name)}`)}
                >
                  <td className="gl-col-rank">{s.isTied ? `T${s.rank}` : s.rank}</td>
                  <td className="gl-col-name">
                    <Link
                      to={`/golf-leaderboard/player/${encodeURIComponent(s.name)}`}
                      className="gl-player-link"
                      onClick={e => e.stopPropagation()}
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="gl-col-points">{Math.round(s.points)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
