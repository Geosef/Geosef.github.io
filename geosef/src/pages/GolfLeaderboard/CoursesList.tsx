import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './GolfLeaderboard.css';
import type { ScoringLogData, Round, CourseVariantData } from '../../types/golf';
import { formatPlusMinus } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';
import { SortTh, SortDir, pmScoreClass, SearchInput } from './leaderboard-utils';
import { SkeletonTableRows } from './GolfSkeleton';

const NINE_HOLE_COURSES = ['Ballwin'];

interface CourseSummary {
  name: string;
  displayName: string;
  frontBack: string;
  isSplit: boolean;
  isNineHole: boolean;
  rounds: number;
  frontRounds: number;
  backRounds: number;
  par: number;
  frontPar: number;
  backPar: number;
  avgPlusMinus: number;
  avgPlusMinusFront: number | null;
  avgPlusMinusBack: number | null;
  lowGross: number | null;
  lowGrossPlayer: string;
  lowGrossPlusMinus: number;
  lowGrossFront: number | null;
  lowGrossPlayerFront: string;
  lowGrossPlusMinusFront: number;
  lowGrossBack: number | null;
  lowGrossPlayerBack: string;
  lowGrossPlusMinusBack: number;
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

    // Collect unique course names in order, and track which front/back sides each has
    const nameOrder: string[] = [];
    const frontBackByName = new Map<string, Set<string>>();
    const frontParByName = new Map<string, number>();
    const backParByName = new Map<string, number>();
    const parByName = new Map<string, number>();

    for (const v of variants.courses) {
      if (!frontBackByName.has(v.name)) {
        nameOrder.push(v.name);
        frontBackByName.set(v.name, new Set());
      }
      if (v.frontBack === 'Front') frontParByName.set(v.name, v.par);
      else if (v.frontBack === 'Back') backParByName.set(v.name, v.par);
      else parByName.set(v.name, v.par);
      if (v.frontBack) frontBackByName.get(v.name)!.add(v.frontBack);
    }

    const result: CourseSummary[] = [];

    for (const name of nameOrder) {
      const fbs = frontBackByName.get(name)!;
      const hasBothSides = fbs.has('Front') && fbs.has('Back');
      const isNineHole = NINE_HOLE_COURSES.includes(name);

      if (hasBothSides) {
        const frontArr = rounds.filter(r => r.course === name && r.frontBack === 'Front');
        const backArr  = rounds.filter(r => r.course === name && r.frontBack === 'Back');
        const allArr   = [...frontArr, ...backArr];

        const bestFront = frontArr.length > 0 ? frontArr.reduce((b, r) => r.score < b.score ? r : b) : null;
        const bestBack  = backArr.length  > 0 ? backArr.reduce((b, r) => r.score < b.score ? r : b) : null;
        const bestAll   = allArr.length   > 0 ? allArr.reduce((b, r) => r.score < b.score ? r : b) : null;

        const fp = frontParByName.get(name) ?? 0;
        const bp = backParByName.get(name) ?? 0;

        result.push({
          name,
          displayName: name,
          frontBack: '',
          isSplit: true,
          isNineHole,
          rounds: allArr.length,
          frontRounds: frontArr.length,
          backRounds: backArr.length,
          par: fp + bp,
          frontPar: fp,
          backPar: bp,
          avgPlusMinus: allArr.length > 0
            ? allArr.reduce((s, r) => s + r.plusMinus, 0) / allArr.length
            : 0,
          avgPlusMinusFront: frontArr.length > 0
            ? frontArr.reduce((s, r) => s + r.plusMinus, 0) / frontArr.length
            : null,
          avgPlusMinusBack: backArr.length > 0
            ? backArr.reduce((s, r) => s + r.plusMinus, 0) / backArr.length
            : null,
          lowGross: bestAll?.score ?? null,
          lowGrossPlayer: bestAll?.player ?? '',
          lowGrossPlusMinus: bestAll?.plusMinus ?? 0,
          lowGrossFront: bestFront?.score ?? null,
          lowGrossPlayerFront: bestFront?.player ?? '',
          lowGrossPlusMinusFront: bestFront?.plusMinus ?? 0,
          lowGrossBack: bestBack?.score ?? null,
          lowGrossPlayerBack: bestBack?.player ?? '',
          lowGrossPlusMinusBack: bestBack?.plusMinus ?? 0,
        });
      } else {
        // Deduplicate by frontBack — multiple tee options per nine produce duplicate nines
        const uniqueNines = new Map<string, typeof variants.courses[0]>();
        for (const v of variants.courses.filter(v => v.name === name)) {
          if (!uniqueNines.has(v.frontBack)) uniqueNines.set(v.frontBack, v);
        }
        for (const v of uniqueNines.values()) {
          const matching: Round[] = v.frontBack
            ? rounds.filter(r => r.course === v.name && r.frontBack === v.frontBack)
            : rounds.filter(r => r.course === v.name);

          const displayName = v.frontBack ? `${v.name} ${v.frontBack}` : v.name;
          const best = matching.length > 0
            ? matching.reduce((b, r) => r.score < b.score ? r : b)
            : null;

          result.push({
            name: v.name,
            displayName,
            frontBack: v.frontBack,
            isSplit: false,
            isNineHole: false,
            rounds: matching.length,
            frontRounds: 0,
            backRounds: 0,
            par: v.par,
            frontPar: 0,
            backPar: 0,
            avgPlusMinus: matching.length > 0
              ? matching.reduce((s, r) => s + r.plusMinus, 0) / matching.length
              : 0,
            avgPlusMinusFront: null,
            avgPlusMinusBack: null,
            lowGross: best?.score ?? null,
            lowGrossPlayer: best?.player ?? '',
            lowGrossPlusMinus: best?.plusMinus ?? 0,
            lowGrossFront: null,
            lowGrossPlayerFront: '',
            lowGrossPlusMinusFront: 0,
            lowGrossBack: null,
            lowGrossPlayerBack: '',
            lowGrossPlusMinusBack: 0,
          });
        }
      }
    }

    return result;
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

  const loading = !variants;

  return (
    <div className="gl-wrapper">
      <div className="gl-header gl-header--list">
        <h1 className="gl-title">All Courses</h1>
      </div>

      <div className="gl-controls-bar">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Filter courses…" />
      </div>

      <div className="gl-content">
        {loading ? (
          <table className="gl-table">
            <thead>
              <tr>
                <th className="gl-col-name">Course</th>
                <th>Rounds</th>
                <th>Par</th>
                <th>Avg +/-</th>
                <th className="gl-col-lowgross">Low Gross</th>
              </tr>
            </thead>
            <tbody>
              <SkeletonTableRows rows={8} cols={5} />
            </tbody>
          </table>
        ) : display.length > 0 ? (
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
                const rowClass = ['gl-row', i % 2 === 0 ? 'gl-row-even' : ''].filter(Boolean).join(' ');

                if (c.isSplit) {
                  const courseUrl = `/golf-leaderboard/course/${encodeURIComponent(c.name)}`;
                  return (
                    <tr key={`${c.name}|split`} className={rowClass} onClick={() => navigate(courseUrl)}>
                      <td className="gl-col-name">
                        {c.name}
                        {c.isNineHole && (
                          <span className="gl-col-nine-badge">(9 holes)</span>
                        )}
                      </td>
                      <td>{c.rounds > 0 ? c.rounds : '—'}</td>
                      <td>
                        {c.frontPar > 0 && c.backPar > 0
                          ? `${c.frontPar}/${c.backPar}`
                          : c.par || '—'}
                      </td>
                      <td>
                        {c.avgPlusMinusFront !== null && (
                          <span className={`gl-split-line ${pmScoreClass(Math.round(c.avgPlusMinusFront))}`}>
                            F {formatPlusMinus(Math.round(c.avgPlusMinusFront))}
                          </span>
                        )}
                        {c.avgPlusMinusBack !== null && (
                          <span className={`gl-split-line ${pmScoreClass(Math.round(c.avgPlusMinusBack))}`}>
                            B {formatPlusMinus(Math.round(c.avgPlusMinusBack))}
                          </span>
                        )}
                        {c.avgPlusMinusFront === null && c.avgPlusMinusBack === null && '—'}
                      </td>
                      <td className="gl-col-lowgross">
                        {c.lowGrossFront !== null && (
                          <span className="gl-split-line">
                            F:{' '}
                            <Link
                              to={`/golf-leaderboard/player/${encodeURIComponent(c.lowGrossPlayerFront)}`}
                              className="cd-player-link"
                              onClick={e => e.stopPropagation()}
                            >
                              {c.lowGrossPlayerFront}
                            </Link>
                            {' '}
                            <span className={pmScoreClass(c.lowGrossPlusMinusFront)}>
                              {c.lowGrossFront} ({formatPlusMinus(c.lowGrossPlusMinusFront)})
                            </span>
                          </span>
                        )}
                        {c.lowGrossBack !== null && (
                          <span className="gl-split-line">
                            B:{' '}
                            <Link
                              to={`/golf-leaderboard/player/${encodeURIComponent(c.lowGrossPlayerBack)}`}
                              className="cd-player-link"
                              onClick={e => e.stopPropagation()}
                            >
                              {c.lowGrossPlayerBack}
                            </Link>
                            {' '}
                            <span className={pmScoreClass(c.lowGrossPlusMinusBack)}>
                              {c.lowGrossBack} ({formatPlusMinus(c.lowGrossPlusMinusBack)})
                            </span>
                          </span>
                        )}
                        {c.lowGrossFront === null && c.lowGrossBack === null && '—'}
                      </td>
                    </tr>
                  );
                }

                const avgRounded = Math.round(c.avgPlusMinus);
                const courseUrl = `/golf-leaderboard/course/${encodeURIComponent(c.name)}${c.frontBack ? `?side=${c.frontBack}` : ''}`;
                return (
                  <tr key={`${c.name}|${c.frontBack}`} className={rowClass} onClick={() => navigate(courseUrl)}>
                    <td className="gl-col-name">{c.displayName}</td>
                    <td>{c.rounds > 0 ? c.rounds : '—'}</td>
                    <td>{c.par || '—'}</td>
                    <td className={c.rounds > 0 ? pmScoreClass(avgRounded) : ''}>
                      {c.rounds > 0 ? formatPlusMinus(avgRounded) : '—'}
                    </td>
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
                          <span className={pmScoreClass(c.lowGrossPlusMinus)}>
                            {c.lowGross} ({formatPlusMinus(c.lowGrossPlusMinus)})
                          </span>
                        </>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="gl-loading">No courses found.</div>
        )}
      </div>
    </div>
  );
}
