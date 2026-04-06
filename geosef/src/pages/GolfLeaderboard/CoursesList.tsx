import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './GolfLeaderboard.css';
import type { ScoringLogData, Round } from '../../types/golf';
import { formatPlusMinus } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';
import { SortTh, SortDir } from './leaderboard-utils';

interface CourseSummary {
  name: string;
  rounds: number;
  par: number;
  avgPlusMinus: number;
  lowGross: number;
}

function pmScoreClass(pm: number): string {
  return pm < 0 ? 'gl-score-under' : 'gl-score-even';
}

export default function CoursesList() {
  const navigate = useNavigate();
  const [data, setData] = useState<ScoringLogData | null>(sessionCache.scoringLog);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('rounds');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  const courses = useMemo<CourseSummary[]>(() => {
    if (!data) return [];
    const map = new Map<string, Round[]>();
    for (const r of data.rounds) {
      if (!map.has(r.course)) map.set(r.course, []);
      map.get(r.course)!.push(r);
    }
    return [...map.entries()].map(([name, rounds]) => ({
      name,
      rounds: rounds.length,
      par: rounds[0].coursePar,
      avgPlusMinus: rounds.reduce((sum, r) => sum + r.plusMinus, 0) / rounds.length,
      lowGross: Math.min(...rounds.map(r => r.score)),
    }));
  }, [data]);

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // rounds & lowGross: more/higher shown first; avgPlusMinus: lower (better) first
      setSortDir(key === 'avgPlusMinus' || key === 'name' ? 'asc' : 'desc');
    }
  }

  const filtered = searchQuery.trim()
    ? courses.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : courses;

  const display = [...filtered].sort((a, b) => {
    if (sortKey === 'name') {
      const cmp = a.name.localeCompare(b.name);
      return sortDir === 'asc' ? cmp : -cmp;
    }
    const aVal = a[sortKey as keyof CourseSummary] as number;
    const bVal = b[sortKey as keyof CourseSummary] as number;
    if (aVal === bVal) return 0;
    const cmp = aVal < bVal ? -1 : 1;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="gl-wrapper">
      <div className="gl-header">
        <h1 className="gl-title">All Courses</h1>
      </div>

      <div className="gl-controls-bar">
        <div className="gl-search-row">
          <input
            type="text"
            className="gl-search-input"
            placeholder="Filter courses…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && <button className="gl-search-clear" onClick={() => setSearchQuery('')}>✕</button>}
        </div>
      </div>

      <div className="gl-content">
        {display.length > 0 ? (
          <table className="gl-table">
            <thead>
              <tr>
                <SortTh label="Course" sortK="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="gl-col-name" />
                <SortTh label="Rounds" sortK="rounds" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <th>Par</th>
                <SortTh label="Avg +/-" sortK="avgPlusMinus" currentKey={sortKey} dir={sortDir} onSort={handleSort} invertArrow />
                <SortTh label="Low Gross" sortK="lowGross" currentKey={sortKey} dir={sortDir} onSort={handleSort} invertArrow />
              </tr>
            </thead>
            <tbody>
              {display.map((c, i) => {
                const avgRounded = Math.round(c.avgPlusMinus);
                return (
                  <tr
                    key={c.name}
                    className={['gl-row', i % 2 === 0 ? 'gl-row-even' : ''].filter(Boolean).join(' ')}
                    onClick={() => navigate(`/golf-leaderboard/course/${encodeURIComponent(c.name)}`)}
                  >
                    <td className="gl-col-name">{c.name}</td>
                    <td>{c.rounds}</td>
                    <td>{c.par}</td>
                    <td className={pmScoreClass(avgRounded)}>{formatPlusMinus(avgRounded)}</td>
                    <td>{c.lowGross}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          !data && <div className="gl-loading">Loading courses…</div>
        )}
      </div>
    </div>
  );
}
