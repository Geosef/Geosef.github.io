import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import './GolfLeaderboard.css';
import './CourseDetail.css';
import type { Round, ScoringLogData, CourseInfoData, CourseVariantData } from '../../types/golf';
import { formatPlusMinus, formatDate } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';
import { pmScoreClass, countBy } from './leaderboard-utils';
import { SkeletonDetailHeader, SkeletonSection } from './GolfSkeleton';

const MEDALS = ['🥇', '🥈', '🥉'];

function topRoundsByGross(rounds: Round[], n = 3): Round[] {
  return [...rounds].sort((a, b) => a.score - b.score).slice(0, n);
}

function topRoundsByNet(rounds: Round[], n = 3): Round[] {
  return [...rounds].sort((a, b) => a.netScore - b.netScore).slice(0, n);
}

function NotableCol({ label, rounds, scoreCell }: {
  label: string;
  rounds: Round[];
  scoreCell: (r: Round) => React.ReactNode;
}) {
  return (
    <div className="cd-notable-col">
      <div className="cd-notable-label">{label}</div>
      {rounds.map((r, i) => (
        <div key={i} className="cd-notable-row">
          <span className="cd-notable-medal">{MEDALS[i]}</span>
          <span className="cd-notable-info">
            <Link
              to={`/golf-leaderboard/player/${encodeURIComponent(r.player)}`}
              className="cd-player-link"
            >
              {r.player}
            </Link>
            <span className="cd-notable-date">{formatDate(r.datePlayed)}</span>
          </span>
          <span className="cd-notable-score">
            {scoreCell(r)}
          </span>
        </div>
      ))}
    </div>
  );
}

function GrossScore({ score, coursePar }: { score: number; coursePar: number }) {
  const grossPM = score - coursePar;
  return (
    <span className={pmScoreClass(grossPM)}>
      {score} ({formatPlusMinus(grossPM)})
    </span>
  );
}

function NetScore({ score, netScore, coursePar, plusMinus }: {
  score: number;
  netScore: number;
  coursePar: number;
  plusMinus: number;
}) {
  const netPlusMinus = netScore - coursePar;
  return (
    <>
      <span className={pmScoreClass(plusMinus)}>{score}</span>
      {' / '}
      <span className={pmScoreClass(netPlusMinus)}>
        {netScore} ({formatPlusMinus(netPlusMinus)})
      </span>
    </>
  );
}

export default function CourseDetail() {
  const { courseName } = useParams<{ courseName: string }>();
  const [searchParams] = useSearchParams();
  const side = searchParams.get('side'); // "Front", "Back", or null
  const navigate = useNavigate();
  const location = useLocation();

  function goBack() {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/golf-leaderboard');
    }
  }

  const [loading, setLoading] = useState(!sessionCache.scoringLog || !sessionCache.courseInfo);
  const [error, setError] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<'All' | 'Front' | 'Back'>('All');

  useEffect(() => {
    if (!courseName) return;

    const fetches: Promise<void>[] = [];

    if (!sessionCache.scoringLog) {
      fetches.push(
        fetch(`${APPS_SCRIPT_URL}?action=scoringLog`)
          .then(r => r.json())
          .then((data: ScoringLogData) => { sessionCache.scoringLog = data; })
          .catch(() => { setError('Could not load course data.'); })
      );
    }

    if (!sessionCache.courseInfo) {
      fetches.push(
        fetch(`${APPS_SCRIPT_URL}?action=courseInfo`)
          .then(r => r.json())
          .then((data: CourseInfoData) => { sessionCache.courseInfo = data; })
          .catch(() => {})
      );
    }

    if (!sessionCache.courseVariants) {
      fetch(`${APPS_SCRIPT_URL}?action=courses`)
        .then(r => r.json())
        .then((data: CourseVariantData) => {
          sessionCache.courseVariants = data;
          forceUpdate(n => n + 1);
        })
        .catch(() => {});
    }

    if (fetches.length > 0) {
      Promise.all(fetches).then(() => {
        setLoading(false);
        forceUpdate(n => n + 1);
      });
    } else {
      setLoading(false);
    }
  }, [courseName]);

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

  if (error || !courseName) {
    return (
      <div className="gl-detail-wrapper">
        <button onClick={goBack} className="gl-detail-back">← Back</button>
        <div className="gl-detail-error">{error ?? 'Course not found.'}</div>
      </div>
    );
  }

  const decoded = decodeURIComponent(courseName);
  const allRounds = (sessionCache.scoringLog?.rounds ?? []).filter(r => r.course === decoded);

  const rounds = side
    ? allRounds.filter(r => r.frontBack === side)
    : allRounds;

  const par = allRounds[0]?.coursePar;

  const history = [...rounds].sort(
    (a, b) => new Date(b.datePlayed).getTime() - new Date(a.datePlayed).getTime()
  );
  const players = countBy(rounds, r => r.player);

  const info = sessionCache.courseInfo?.courses.find(c => c.name === decoded);

  const displayTitle = info?.fullName || decoded;
  const headingTitle = side ? `${displayTitle} — ${side} 9` : displayTitle;

  const showSplitNotable = !side && allRounds.some(r => r.frontBack === 'Front') && allRounds.some(r => r.frontBack === 'Back');
  const frontRounds = allRounds.filter(r => r.frontBack === 'Front');
  const backRounds  = allRounds.filter(r => r.frontBack === 'Back');

  // Par display — for combined view, sum front + back par
  const frontPar = frontRounds[0]?.coursePar;
  const backPar  = backRounds[0]?.coursePar;
  const parDisplay = showSplitNotable && frontPar != null && backPar != null
    ? `Par ${frontPar + backPar}`
    : par != null
      ? `Par ${par}`
      : 'Par —';

  // Round history with optional F/B filter
  const historyRounds = showSplitNotable && historyFilter !== 'All'
    ? history.filter(r => r.frontBack === historyFilter)
    : history;

  // Tee options — built from the playing handicaps sheet (courseVariants)
  const allVariantsForCourse = (sessionCache.courseVariants?.courses ?? [])
    .filter(v => v.name === decoded);

  // When viewing a specific side, filter to just that nine
  const variantsInView = side
    ? allVariantsForCourse.filter(v => v.frontBack === side || v.frontBack === '')
    : allVariantsForCourse;

  // Collect unique tee names in order of appearance
  const teeNameOrder: string[] = [];
  for (const v of variantsInView) {
    if (v.tees && !teeNameOrder.includes(v.tees)) teeNameOrder.push(v.tees);
  }

  interface TeeOption {
    tee: string;
    front: { par: number; rating: number; slope: number } | null;
    back:  { par: number; rating: number; slope: number } | null;
    single: { par: number; rating: number; slope: number } | null;
  }

  const teeOptions: TeeOption[] = teeNameOrder.map(tee => {
    const forTee = variantsInView.filter(v => v.tees === tee);
    const fv = forTee.find(v => v.frontBack === 'Front');
    const bv = forTee.find(v => v.frontBack === 'Back');
    const sv = forTee.find(v => !v.frontBack);
    return {
      tee,
      front: fv ? { par: fv.par, rating: fv.rating, slope: fv.slope } : null,
      back:  bv ? { par: bv.par, rating: bv.rating, slope: bv.slope } : null,
      single: sv ? { par: sv.par, rating: sv.rating, slope: sv.slope } : null,
    };
  });

  return (
    <div className="gl-detail-wrapper">
      <div className="gl-detail-header">
        <button onClick={goBack} className="gl-detail-back">← Back</button>
        <h1 className="cd-name">{headingTitle}</h1>
        <p className="cd-meta">
          {parDisplay} · {rounds.length} round{rounds.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="gl-detail-content">

        {/* Course Info */}
        {info && (
          <section className="gl-detail-section cd-info-section">
            <div className="cd-info-row">
              {info.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(info.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cd-info-link"
                >
                  📍 {info.address}
                </a>
              )}
              {info.phone && (
                <a href={`tel:${info.phone}`} className="cd-info-link">
                  📞 {info.phone}
                </a>
              )}
              {info.teeTimesUrl && (
                <a
                  href={info.teeTimesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cd-info-link"
                >
                  🕐 Book Tee Times
                </a>
              )}
              {info.rate && (
                <span className="cd-info-rate">{info.rate}</span>
              )}
            </div>
            {info.restrictions && (
              <div className="cd-restrictions">
                {info.restrictions.split(' | ').map((item, i) => (
                  <span key={i} className="cd-restriction-chip">{item}</span>
                ))}
              </div>
            )}
            {(info.architect || info.yearBuilt) && (
              <div className="cd-info-meta">
                {[
                  info.architect && `Architect: ${info.architect}`,
                  info.yearBuilt && `Est. ${info.yearBuilt}`,
                ].filter(Boolean).join(' · ')}
              </div>
            )}
          </section>
        )}

        {/* Tee Options */}
        {teeOptions.length > 0 && (
          <section className="gl-detail-section">
            <h2 className="gl-detail-section-title">Tee Options</h2>
            <table className="cd-tee-table">
              <thead>
                <tr>
                  <th>Tees</th>
                  <th>Par</th>
                  <th>Rating</th>
                  <th>Slope</th>
                </tr>
              </thead>
              <tbody>
                {teeOptions.map(t => {
                  const hasSplit = t.front !== null && t.back !== null;
                  const data = hasSplit ? null : (t.front ?? t.back ?? t.single);
                  return (
                    <tr key={t.tee}>
                      <td className="cd-tee-name">{t.tee}</td>
                      <td>
                        {hasSplit ? (
                          <>
                            <span className="gl-split-line">F: {t.front!.par}</span>
                            <span className="gl-split-line">B: {t.back!.par}</span>
                          </>
                        ) : data ? data.par : '—'}
                      </td>
                      <td>
                        {hasSplit ? (
                          <>
                            <span className="gl-split-line">F: {t.front!.rating.toFixed(1)}</span>
                            <span className="gl-split-line">B: {t.back!.rating.toFixed(1)}</span>
                          </>
                        ) : data ? data.rating.toFixed(1) : '—'}
                      </td>
                      <td>
                        {hasSplit ? (
                          <>
                            <span className="gl-split-line">F: {t.front!.slope}</span>
                            <span className="gl-split-line">B: {t.back!.slope}</span>
                          </>
                        ) : data ? data.slope : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Notable Rounds */}
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Notable Rounds</h2>

          {showSplitNotable ? (
            <>
              {frontRounds.length > 0 && (
                <>
                  <div className="cd-notable-side-label">Front 9</div>
                  <div className="cd-notable-grid">
                    <NotableCol
                      label="Low Gross"
                      rounds={topRoundsByGross(frontRounds)}
                      scoreCell={r => <GrossScore score={r.score} coursePar={r.coursePar} />}
                    />
                    <NotableCol
                      label="Low Net"
                      rounds={topRoundsByNet(frontRounds)}
                      scoreCell={r => <NetScore score={r.score} netScore={r.netScore} coursePar={r.coursePar} plusMinus={r.plusMinus} />}
                    />
                  </div>
                </>
              )}
              {backRounds.length > 0 && (
                <>
                  <div className="cd-notable-side-label">Back 9</div>
                  <div className="cd-notable-grid">
                    <NotableCol
                      label="Low Gross"
                      rounds={topRoundsByGross(backRounds)}
                      scoreCell={r => <GrossScore score={r.score} coursePar={r.coursePar} />}
                    />
                    <NotableCol
                      label="Low Net"
                      rounds={topRoundsByNet(backRounds)}
                      scoreCell={r => <NetScore score={r.score} netScore={r.netScore} coursePar={r.coursePar} plusMinus={r.plusMinus} />}
                    />
                  </div>
                </>
              )}
              {frontRounds.length === 0 && backRounds.length === 0 && (
                <p className="gl-detail-empty">No rounds recorded yet.</p>
              )}
            </>
          ) : (
            rounds.length > 0 ? (
              <div className="cd-notable-grid">
                <NotableCol
                  label="Low Gross"
                  rounds={topRoundsByGross(rounds)}
                  scoreCell={r => <GrossScore score={r.score} coursePar={r.coursePar} />}
                />
                <NotableCol
                  label="Low Net"
                  rounds={topRoundsByNet(rounds)}
                  scoreCell={r => <NetScore score={r.score} netScore={r.netScore} coursePar={r.coursePar} plusMinus={r.plusMinus} />}
                />
              </div>
            ) : (
              <p className="gl-detail-empty">No rounds recorded yet.</p>
            )
          )}
        </section>

        {/* Frequent Players */}
        {players.length > 0 && (
          <section className="gl-detail-section">
            <h2 className="gl-detail-section-title">Frequent Players</h2>
            {players.map(({ value: player, count }) => (
              <div key={player} className="gl-stat-row">
                <Link
                  to={`/golf-leaderboard/player/${encodeURIComponent(player)}`}
                  className="gl-stat-link"
                >
                  {player}
                </Link>
                <span className="gl-stat-count">{count} round{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </section>
        )}

        {/* Round History */}
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Round History</h2>
          {showSplitNotable && (
            <div className="gl-filter-chips">
              {(['All', 'Front', 'Back'] as const).map(f => (
                <button
                  key={f}
                  className={`gl-chip ${historyFilter === f ? 'gl-chip--active' : ''}`}
                  onClick={() => setHistoryFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
          {historyRounds.length === 0 ? (
            <p className="gl-detail-empty">No rounds recorded yet.</p>
          ) : (
            historyRounds.map((r, i) => (
              <div key={i} className="cd-round-row">
                <span className="cd-round-date">{formatDate(r.datePlayed)}</span>
                <Link
                  to={`/golf-leaderboard/player/${encodeURIComponent(r.player)}`}
                  className="cd-player-link cd-round-player"
                >
                  {r.player}
                </Link>
                {r.tees && <span className="cd-round-tees">{r.tees}</span>}
                {r.frontBack && (
                  <span className="cd-round-fb">{r.frontBack}</span>
                )}
                <span className={`cd-round-scores ${pmScoreClass(r.plusMinus)}`}>
                  {r.score} / {r.netScore} ({formatPlusMinus(r.plusMinus)})
                </span>
                <span className="cd-round-hcp">HCP {r.playingHandicap}</span>
              </div>
            ))
          )}
        </section>

      </div>
    </div>
  );
}
