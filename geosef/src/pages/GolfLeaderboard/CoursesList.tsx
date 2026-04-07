import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './GolfLeaderboard.css';
import type { ScoringLogData, Round, CourseVariantData } from '../../types/golf';
import { formatPlusMinus } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';
import { SortTh, SortDir, pmScoreClass, SearchInput } from './leaderboard-utils';

const NINE_HOLE_COURSES = ['Ballwin'];

interface CourseSummary {
  name: string;
  displayName: string;
  frontBack: string;
  rounds: number;
  par: number;
  avgPlusMinus: number;
  lowGross: number | null;
  lowGrossPlayer: string;
  lowGrossPlusMinus: number;
}

export default function CoursesList() {
  const navigate = useNavigate();
  const [scoringLog, setScoringLog] = useState<ScoringLogData | null>(sessionCache.scoringLog);
  const [variants, setVariants] = useState<CourseVariantData | null>(sessionCache.courseVariants);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    if (!sessionCache.scoringLog) {
      fetch(`${APPS_SCRIPT_URL}?action=scoringLog`)
        .then(r => r.json())
        .then((d: ScoringLogData) => {
          sessionCache.scoringLog = d;
          setScoringLog(d);
        })
        .catch(() => {});
    }
    if (!sessionCache.courseVariants) {
      fetch(`${APPS_SCRIPT_URL}?action=courses`)
        .then(r => r.json())
        .then((d: CourseVariantData) => {
          sessionCache.courseVariants = d;
          setVariants(d);
        })
        .catch(() => {});
    }
  }, []);

  const courses = useMemo<CourseSummary[]>(() => {
    if (!variants?.courses?.length) return [];

    const rounds = scoringLog?.rounds ?? [];

    return variants.courses.map(v => {
      const is9Hole = NINE_HOLE_COURSES.includes(v.name);
      const matching: Round[] = is9Hole
        ? rounds.filter(r => r.course === v.name)
        : rounds.filter(r => r.course === v.name && r.frontBack === v.frontBack);

      const displayName = v.frontBack ? `${v.name} ${v.frontBack}` : v.name;

      if (matching.length === 0) {
        return {
          name: v.name,
          displayName,
          frontBack: v.frontBack,
          rounds: 0,
          par: v.par,
          avgPlusMinus: 0,
          lowGross: null,
          lowGrossPlayer: '',
          lowGrossPlusMinus: 0,
        };
      }

      const best = matching.reduce((b, r) => r.score < b.score ? r : b, matching[0]);
      return {
        name: v.name,
        displayName,
        frontBack: v.frontBack,
        rounds: matching.length,
        par: v.par,
        avgPlusMinus: matching.reduce((sum, r) => sum + r.plusMinus, 0) / matching.length,
        lowGross: best.score,
        lowGrossPlayer: best.player,
        lowGrossPlusMinus: best.plusMinus,
      };
    });
  }, [variants, scoringLog]);

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'avgPlusMinus' || key === 'name' ? 'asc' : 'desc');
    }
  }

  const filtered = searchQuery.trim()
    ? courses.filter(c => c.displayName.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : courses;

  const display = [...filtered].sort((a, b) => {
    if (sortKey === 'name') {
      const cmp = a.displayName.localeCompare(b.displayName);
      return sortDir === 'asc' ? cmp : -cmp;
    }
    const aVal = sortKey === 'lowGross'
      ? (a.lowGross ?? Infinity)
      : (a[sortKey as keyof CourseSummary] as number);
    const bVal = sortKey === 'lowGross'
      ? (b.lowGross ?? Infinity)
      : (b[sortKey as keyof CourseSummary] as number);
    if (aVal === bVal) return 0;
    const cmp = aVal < bVal ? -1 : 1;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Variants are the essential data — scoringLog may already be cached
  const loading = !variants;

  return (
    <div className="gl-wrapper">
      <div className="gl-header">
        <h1 className="gl-title">All Courses</h1>
      </div>

      <div className="gl-controls-bar">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Filter courses…" />
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
                <th className="gl-col-lowgross">Low Gross</th>
              </tr>
            </thead>
            <tbody>
              {display.map((c, i) => {
                const avgRounded = Math.round(c.avgPlusMinus);
                const courseUrl = `/golf-leaderboard/course/${encodeURIComponent(c.name)}${c.frontBack ? `?side=${c.frontBack}` : ''}`;
                return (
                  <tr
                    key={`${c.name}|${c.frontBack}`}
                    className={['gl-row', i % 2 === 0 ? 'gl-row-even' : ''].filter(Boolean).join(' ')}
                    onClick={() => navigate(courseUrl)}
                  >
                    <td className="gl-col-name">{c.displayName}</td>
                    <td>{c.rounds > 0 ? c.rounds : '—'}</td>
                    <td>{c.par || '—'}</td>
                    <td className={c.rounds > 0 ? pmScoreClass(avgRounded) : ''}>{c.rounds > 0 ? formatPlusMinus(avgRounded) : '—'}</td>
                    <td className="gl-col-lowgross">
                      {c.lowGross !== null ? (
                        <>
                          <Link
                            to={`/golf-leaderboard/player/${encodeURIComponent(c.lowGrossPlayer)}`}
                            className="cd-player-link"
                            onClick={e => e.stopPropagation()}
                          >
                            {c.lowGrossPlayer}
                          </Link>
                          {' '}
                          <span className={pmScoreClass(c.lowGrossPlusMinus)}>{c.lowGross}</span>
                        </>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="gl-loading">{loading ? 'Loading courses…' : 'No courses found.'}</div>
        )}
      </div>
    </div>
  );
}
