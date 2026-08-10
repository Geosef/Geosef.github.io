import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './GolfLeaderboard.css';
import type { LeaderboardData } from '../../types/golf';
import { sessionCache, loadAction } from '../../golf-cache';
import { SortTh, sortStandings, SortDir, StickyListHeader, ListError, EmptyRow, FavoritesToggle, scrollToListTop } from './leaderboard-utils';
import { SkeletonTableRows } from './GolfSkeleton';
import { useUserPrefs } from '../../hooks/useUserPrefs';
import { sortByFavorites } from '../../lib/sortByFavorites';
import FavoriteStar from '../../components/FavoriteStar';
import FavoritesToast from '../../components/FavoritesToast';
import PlayerFlair from '../../components/PlayerFlair';

export default function PlayersList() {
  const navigate = useNavigate();
  const { prefs, toggleFavoritePlayer, isSignedIn, saveError, clearSaveError } = useUserPrefs();
  const [data, setData] = useState<LeaderboardData | null>(sessionCache.season);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [favOnly, setFavOnly] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    loadAction('season').then(setData).catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (sessionCache.season) return;
    load();
  }, [load]);

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'points' ? 'desc' : 'asc');
    }
    scrollToListTop();
  }

  const standings = data?.standings ?? [];
  const favPlayers = prefs?.favoritePlayers ?? [];
  const favCount = favPlayers.length;
  const favActive = favOnly && favCount > 0;
  const base = favActive ? standings.filter(s => favPlayers.includes(s.name)) : standings;
  const filtered = searchQuery.trim()
    ? base.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : base;
  const sorted = sortStandings(filtered, sortKey, sortDir, 'season');
  const display = sortByFavorites(sorted, favPlayers, s => s.name);
  // In the favorites view there's no need to paginate — show them all.

  return (
    <div className="gl-wrapper gl-wrapper--table">
      <StickyListHeader
        title="All Players"
        search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Filter players…' }}
      >
        {isSignedIn && favCount > 0 && (
          <FavoritesToggle favOnly={favActive} onChange={setFavOnly} count={favCount} />
        )}
      </StickyListHeader>

      <div className="gl-content">
        {error && !data ? (
          <ListError onRetry={load} />
        ) : (
        <div className="gl-table-scroll">
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
            ) : display.length === 0 ? (
              <EmptyRow colSpan={3}>
                {searchQuery.trim()
                  ? `No players match “${searchQuery.trim()}”.`
                  : favActive
                    ? 'No favorite players yet — tap the ☆ on any player to add one.'
                    : 'No players yet.'}
              </EmptyRow>
            ) : (
              display.map((s, i) => (
                <tr
                  key={s.name}
                  className={['gl-row', i % 2 === 0 ? 'gl-row-even' : ''].filter(Boolean).join(' ')}
                  onClick={() => navigate(`/golf-leaderboard/player/${encodeURIComponent(s.name)}`)}
                >
                  <td className="gl-col-rank">{s.isTied ? `T${s.rank}` : s.rank}</td>
                  <td className="gl-col-name">
                    <div className="gl-name-cell">
                      {/* Name and flair group as one flex child so the cell's
                          space-between only pushes the star to the edge. */}
                      <span>
                        <Link
                          to={`/golf-leaderboard/player/${encodeURIComponent(s.name)}`}
                          className="gl-player-link"
                          onClick={e => e.stopPropagation()}
                        >
                          {s.name}
                        </Link>
                        <PlayerFlair name={s.name} />
                      </span>
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
          </tbody>
        </table>
        </div>
        )}
      </div>
      <FavoritesToast show={saveError} onDismiss={clearSaveError} />
    </div>
  );
}
