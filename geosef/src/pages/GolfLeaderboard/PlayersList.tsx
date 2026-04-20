import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './GolfLeaderboard.css';
import type { MonthlyData } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';
import { SortTh, sortStandings, SortDir, StickyListHeader, PAGE_SIZE, ShowAllRow } from './leaderboard-utils';
import { SkeletonTableRows } from './GolfSkeleton';
import { useUserPrefs } from '../../hooks/useUserPrefs';
import { sortByFavorites } from '../../lib/sortByFavorites';
import FavoriteStar from '../../components/FavoriteStar';

// TODO: Temporary — sourcing from April monthly sheet while "Total Points" is stale.
// Revert to `?action=leaderboard` / `sessionCache.season` once Total Points is caught up.
export default function PlayersList() {
  const navigate = useNavigate();
  const { prefs, toggleFavoritePlayer } = useUserPrefs();
  const [data, setData] = useState<MonthlyData | null>(sessionCache.monthly.get('April') ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (sessionCache.monthly.get('April')) return;
    fetch(`${APPS_SCRIPT_URL}?action=monthly&month=April`)
      .then(r => r.json())
      .then((d: MonthlyData) => {
        sessionCache.monthly.set('April', d);
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
  const sorted = sortStandings(filtered, sortKey, sortDir, 'season');
  const display = sortByFavorites(sorted, prefs?.favoritePlayers ?? [], s => s.name);
  const visible = showAll ? display : display.slice(0, PAGE_SIZE);

  return (
    <div className="gl-wrapper">
      <StickyListHeader
        title="All Players"
        search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Filter players…' }}
      />

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
              visible.map((s, i) => (
                <tr
                  key={s.name}
                  className={['gl-row', i % 2 === 0 ? 'gl-row-even' : ''].filter(Boolean).join(' ')}
                  onClick={() => navigate(`/golf-leaderboard/player/${encodeURIComponent(s.name)}`)}
                >
                  <td className="gl-col-rank">{s.isTied ? `T${s.rank}` : s.rank}</td>
                  <td className="gl-col-name">
                    <div className="gl-name-cell">
                      <Link
                        to={`/golf-leaderboard/player/${encodeURIComponent(s.name)}`}
                        className="gl-player-link"
                        onClick={e => e.stopPropagation()}
                      >
                        {s.name}
                      </Link>
                      {prefs && (
                        <FavoriteStar
                          isFavorite={prefs.favoritePlayers.includes(s.name)}
                          onToggle={() => toggleFavoritePlayer(s.name)}
                          label={s.name}
                        />
                      )}
                    </div>
                  </td>
                  <td className="gl-col-points">{Math.round(s.points)}</td>
                </tr>
              ))
            )}
            {data && !showAll && display.length > PAGE_SIZE && (
              <ShowAllRow total={display.length} shown={visible.length} colSpan={3} onShowAll={() => setShowAll(true)} />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
