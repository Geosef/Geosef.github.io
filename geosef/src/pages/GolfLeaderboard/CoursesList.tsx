import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './GolfLeaderboard.css';
import type { ScoringLogData, Round, CourseVariantData, CourseInfoData } from '../../types/golf';
import { formatPlusMinus } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';
import { SortTh, SortDir, pmScoreClass, StickyListHeader, Chip, PAGE_SIZE, ShowAllRow } from './leaderboard-utils';
import { SkeletonTableRows } from './GolfSkeleton';
import { useUserPrefs } from '../../hooks/useUserPrefs';
import { sortByFavorites } from '../../lib/sortByFavorites';
import FavoriteStar from '../../components/FavoriteStar';

const NINE_HOLE_COURSES = ['Ballwin'];

interface AvgCell {
  label?: string;
  value: number | null;
}

interface LowGrossCell {
  label?: string;
  player: string;
  score: number;
  plusMinus: number;
}

interface CourseSummary {
  name: string;
  displayName: string;
  frontBack: string;
  isNineHole: boolean;
  rounds: number;
  par: number;
  rate: string | null;
  avgPlusMinus: number;
  lowGross: number | null;
  parCell: string;
  avgCells: AvgCell[];
  lowGrossCells: (LowGrossCell | null)[];
}

export default function CoursesList() {
  const navigate = useNavigate();
  const { prefs, toggleFavoriteCourse } = useUserPrefs();
  const [scoringLog, setScoringLog] = useState<ScoringLogData | null>(sessionCache.scoringLog);
  const [variants, setVariants] = useState<CourseVariantData | null>(sessionCache.courseVariants);
  const [courseInfo, setCourseInfo] = useState<CourseInfoData | null>(sessionCache.courseInfo);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAll, setShowAll] = useState(false);

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
    if (!sessionCache.courseInfo) {
      fetch(`${APPS_SCRIPT_URL}?action=courseInfo`)
        .then(r => r.json())
        .then((d: CourseInfoData) => {
          sessionCache.courseInfo = d;
          setCourseInfo(d);
        })
        .catch(() => {});
    }
  }, []);

  const courses = useMemo<CourseSummary[]>(() => {
    if (!variants?.courses?.length) return [];

    const rounds = scoringLog?.rounds ?? [];
    const normalize = (s: string) => s.replace(/\./g, '').toLowerCase();
    const getInfoEntry = (name: string) =>
      courseInfo?.courses.find(c => c.name === name || normalize(c.name) === normalize(name));
    const getDisplayName = (name: string) => getInfoEntry(name)?.fullName || name;
    const getRate = (name: string): string | null => {
      const r = getInfoEntry(name)?.rate;
      if (!r) return null;
      return r === 'Free' ? 'Free' : `$${r}`;
    };

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

        const avgFront = frontArr.length > 0
          ? frontArr.reduce((s, r) => s + r.plusMinus, 0) / frontArr.length
          : null;
        const avgBack = backArr.length > 0
          ? backArr.reduce((s, r) => s + r.plusMinus, 0) / backArr.length
          : null;

        result.push({
          name,
          displayName: getDisplayName(name),
          frontBack: '',
          isNineHole,
          rounds: allArr.length,
          par: fp + bp,
          rate: getRate(name),
          avgPlusMinus: allArr.length > 0
            ? allArr.reduce((s, r) => s + r.plusMinus, 0) / allArr.length
            : 0,
          lowGross: bestAll?.score ?? null,
          parCell: fp > 0 && bp > 0 ? `${fp}/${bp}` : String(fp + bp || '—'),
          avgCells: [
            { label: 'F', value: avgFront },
            { label: 'B', value: avgBack },
          ],
          lowGrossCells: [
            bestFront ? { label: 'F', player: bestFront.player, score: bestFront.score, plusMinus: bestFront.score - bestFront.coursePar } : null,
            bestBack  ? { label: 'B', player: bestBack.player,  score: bestBack.score,  plusMinus: bestBack.score  - bestBack.coursePar  } : null,
          ],
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

          const displayName = v.frontBack ? `${getDisplayName(v.name)} ${v.frontBack}` : getDisplayName(v.name);
          const best = matching.length > 0
            ? matching.reduce((b, r) => r.score < b.score ? r : b)
            : null;

          const avg = matching.length > 0
            ? matching.reduce((s, r) => s + r.plusMinus, 0) / matching.length
            : 0;

          result.push({
            name: v.name,
            displayName,
            frontBack: v.frontBack,
            isNineHole,
            rounds: matching.length,
            par: v.par,
            rate: getRate(v.name),
            avgPlusMinus: avg,
            lowGross: best?.score ?? null,
            parCell: v.par ? String(v.par) : '—',
            avgCells: [{ value: matching.length > 0 ? avg : null }],
            lowGrossCells: [
              best ? { player: best.player, score: best.score, plusMinus: best.score - best.coursePar } : null,
            ],
          });
        }
      }
    }

    return result;
  }, [variants, scoringLog, courseInfo]);

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

  const rateToNum = (r: string | null) => {
    if (!r) return Infinity;
    if (r === 'Free') return 0;
    return parseFloat(r.replace('$', '')) || Infinity;
  };

  const display = [...filtered].sort((a, b) => {
    if (sortKey === 'name') {
      const cmp = a.displayName.localeCompare(b.displayName);
      return sortDir === 'asc' ? cmp : -cmp;
    }
    const aVal = sortKey === 'lowGross'
      ? (a.lowGross ?? Infinity)
      : sortKey === 'rate'
        ? rateToNum(a.rate)
        : (a[sortKey as keyof CourseSummary] as number);
    const bVal = sortKey === 'lowGross'
      ? (b.lowGross ?? Infinity)
      : sortKey === 'rate'
        ? rateToNum(b.rate)
        : (b[sortKey as keyof CourseSummary] as number);
    if (aVal === bVal) return 0;
    const cmp = aVal < bVal ? -1 : 1;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const displayFaved = sortByFavorites(display, prefs?.favoriteCourses ?? [], c => c.name);
  const visible = showAll ? displayFaved : displayFaved.slice(0, PAGE_SIZE);
  const loading = !variants;

  return (
    <div className="gl-wrapper">
      <StickyListHeader
        title="All Courses"
        search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Filter courses…' }}
      />

      <div className="gl-content">
        {loading ? (
          <div className="gl-table-scroll">
            <table className="gl-table gl-courses-table">
              <thead>
                <tr>
                  <th className="gl-col-name">Course</th>
                  <th>Rounds</th>
                  <th>Par</th>
                  <th>Rate</th>
                  <th>Avg +/-</th>
                  <th className="gl-col-lowgross">Low Gross</th>
                </tr>
              </thead>
              <tbody>
                <SkeletonTableRows rows={8} cols={6} />
              </tbody>
            </table>
          </div>
        ) : display.length > 0 ? (
          <div className="gl-table-scroll"><table className="gl-table gl-courses-table">
            <thead>
              <tr>
                <SortTh label="Course" sortK="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="gl-col-name" />
                <SortTh label="Rounds" sortK="rounds" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <th>Par</th>
                <SortTh label="Rate" sortK="rate" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Avg +/-" sortK="avgPlusMinus" currentKey={sortKey} dir={sortDir} onSort={handleSort} invertArrow />
                <th className="gl-col-lowgross">Low Gross</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c, i) => {
                const rowClass = ['gl-row', i % 2 === 0 ? 'gl-row-even' : ''].filter(Boolean).join(' ');
                const courseUrl = `/golf-leaderboard/course/${encodeURIComponent(c.name)}${c.frontBack ? `?side=${c.frontBack}` : ''}`;
                const avgHasAny = c.avgCells.some(a => a.value !== null);
                const lowHasAny = c.lowGrossCells.some(l => l !== null);

                return (
                  <tr key={`${c.name}|${c.frontBack || 'split'}`} className={rowClass} onClick={() => navigate(courseUrl)}>
                    <td className="gl-col-name">
                      <div className="gl-name-cell">
                        <span>
                          {c.name}
                          {c.isNineHole && <Chip className="gl-chip--inline">9 holes</Chip>}
                        </span>
                        {prefs && (
                          <FavoriteStar
                            isFavorite={prefs.favoriteCourses.includes(c.name)}
                            onToggle={() => toggleFavoriteCourse(c.name)}
                            label={c.name}
                          />
                        )}
                      </div>
                    </td>
                    <td>{c.rounds > 0 ? c.rounds : '—'}</td>
                    <td>{c.parCell}</td>
                    <td>{c.rate ?? '—'}</td>
                    <td>
                      {avgHasAny ? c.avgCells.map((cell, idx) => {
                        if (cell.value === null) return null;
                        const rounded = Math.round(cell.value);
                        const cls = pmScoreClass(rounded);
                        return cell.label ? (
                          <span key={idx} className={`gl-split-line ${cls}`}>
                            {cell.label} {formatPlusMinus(rounded)}
                          </span>
                        ) : (
                          <span key={idx} className={cls}>{formatPlusMinus(rounded)}</span>
                        );
                      }) : '—'}
                    </td>
                    <td className="gl-col-lowgross">
                      {lowHasAny ? c.lowGrossCells.map((cell, idx) => {
                        if (!cell) return null;
                        const inner = (
                          <>
                            {cell.label ? `${cell.label}: ` : null}
                            <Link
                              to={`/golf-leaderboard/player/${encodeURIComponent(cell.player)}`}
                              className="cd-player-link"
                              onClick={e => e.stopPropagation()}
                            >
                              {cell.player}
                            </Link>
                            {' '}
                            <span className={pmScoreClass(cell.plusMinus)}>
                              {cell.score} ({formatPlusMinus(cell.plusMinus)})
                            </span>
                          </>
                        );
                        return cell.label ? (
                          <span key={idx} className="gl-split-line">{inner}</span>
                        ) : (
                          <React.Fragment key={idx}>{inner}</React.Fragment>
                        );
                      }) : '—'}
                    </td>
                  </tr>
                );
              })}
              {!showAll && displayFaved.length > PAGE_SIZE && (
                <ShowAllRow total={displayFaved.length} shown={visible.length} colSpan={6} onShowAll={() => setShowAll(true)} />
              )}
            </tbody>
          </table></div>
        ) : (
          <div className="gl-loading">No courses found.</div>
        )}
      </div>
    </div>
  );
}
