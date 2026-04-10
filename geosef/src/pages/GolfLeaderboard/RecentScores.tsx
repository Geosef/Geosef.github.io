import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './GolfLeaderboard.css';
import type { ScoringLogData, Round } from '../../types/golf';
import { formatPlusMinus, formatDate } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';
import { SortTh, SortDir, StickyListHeader, pmScoreClass, lastName, PAGE_SIZE, ShowAllRow } from './leaderboard-utils';
import { SkeletonTableRows } from './GolfSkeleton';

type SortKey = 'date' | 'player' | 'course' | 'gross' | 'net' | 'plusMinus';

function sortRounds(rounds: Round[], key: SortKey, dir: SortDir): Round[] {
  const sorted = [...rounds].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'date':
        cmp = new Date(a.datePlayed).getTime() - new Date(b.datePlayed).getTime();
        break;
      case 'player':
        cmp = lastName(a.player).localeCompare(lastName(b.player));
        break;
      case 'course':
        cmp = a.course.localeCompare(b.course);
        break;
      case 'gross':
        cmp = a.score - b.score;
        break;
      case 'net':
        cmp = a.netScore - b.netScore;
        break;
      case 'plusMinus':
        cmp = a.plusMinus - b.plusMinus;
        break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export default function RecentScores() {
  const [data, setData] = useState<ScoringLogData | null>(sessionCache.scoringLog);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (sessionCache.scoringLog) return;
    fetch(`${APPS_SCRIPT_URL}?action=scoringLog`)
      .then(r => r.json())
      .then((d: ScoringLogData) => {
        sessionCache.scoringLog = d;
        setData(d);
      })
      .catch(() => {});
  }, []);

  function handleSort(key: string) {
    const k = key as SortKey;
    if (k === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(k);
      setSortDir(k === 'date' ? 'desc' : 'asc');
    }
  }

  const rounds = data?.rounds ?? [];
  const q = searchQuery.toLowerCase().trim();
  const filtered = q
    ? rounds.filter(r =>
        r.player.toLowerCase().includes(q) ||
        r.course.toLowerCase().includes(q)
      )
    : rounds;
  const display = sortRounds(filtered, sortKey, sortDir);
  const visible = showAll ? display : display.slice(0, PAGE_SIZE);

  return (
    <div className="gl-wrapper">
      <StickyListHeader
        title="Recent Scores"
        search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Filter player or course…' }}
      />

      <div className="gl-content">
        <div className="gl-table-scroll">
          <table className="gl-table gl-scores-table">
            <thead>
              <tr>
                <SortTh label="Date" sortK="date" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="gl-col-date" invertArrow />
                <SortTh label="Player" sortK="player" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="gl-col-name" />
                <SortTh label="Course" sortK="course" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="gl-col-course" />
                <SortTh label="Gross" sortK="gross" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="gl-col-gross" invertArrow />
                <SortTh label="Net" sortK="net" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="gl-col-net" invertArrow />
                <SortTh label="+/-" sortK="plusMinus" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="gl-col-pm-total" invertArrow />
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <SkeletonTableRows rows={12} cols={6} />
              ) : (
                visible.map((r, i) => (
                  <tr
                    key={i}
                    className={['gl-row', i % 2 === 0 ? 'gl-row-even' : ''].filter(Boolean).join(' ')}
                  >
                    <td className="gl-col-date">{formatDate(r.datePlayed)}</td>
                    <td className="gl-col-name">
                      <Link
                        to={`/golf-leaderboard/player/${encodeURIComponent(r.player)}`}
                        className="gl-player-link"
                      >
                        {lastName(r.player)}
                      </Link>
                    </td>
                    <td className="gl-col-course">
                      <Link
                        to={`/golf-leaderboard/course/${encodeURIComponent(r.course)}`}
                        className="gl-round-course-link"
                      >
                        {r.course}
                      </Link>
                      {r.tees ? ` (${r.tees})` : ''}
                    </td>
                    <td className="gl-col-gross">{r.score}</td>
                    <td className="gl-col-net">{r.netScore}</td>
                    <td className={`gl-col-pm-total ${pmScoreClass(r.plusMinus)}`}>
                      {formatPlusMinus(r.plusMinus)}
                    </td>
                  </tr>
                ))
              )}
              {data && !showAll && display.length > PAGE_SIZE && (
                <ShowAllRow total={display.length} shown={visible.length} colSpan={6} onShowAll={() => setShowAll(true)} />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
