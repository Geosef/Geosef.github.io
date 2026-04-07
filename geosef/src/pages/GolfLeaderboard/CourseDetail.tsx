import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import './GolfLeaderboard.css';
import './CourseDetail.css';
import type { Round, ScoringLogData, CourseInfoData } from '../../types/golf';
import { formatPlusMinus, formatDate } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';
import { pmScoreClass, countBy } from './leaderboard-utils';

const NINE_HOLE_COURSES = ['Ballwin'];
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
          <span className={`cd-notable-score ${pmScoreClass(r.plusMinus)}`}>
            {scoreCell(r)}
          </span>
        </div>
      ))}
    </div>
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
          .catch(() => {}) // course info is non-critical
      );
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
        <div className="gl-detail-loading">Loading…</div>
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
  const is9Hole = NINE_HOLE_COURSES.includes(decoded);
  const allRounds = (sessionCache.scoringLog?.rounds ?? []).filter(r => r.course === decoded);

  if (allRounds.length === 0) {
    return (
      <div className="gl-detail-wrapper">
        <button onClick={goBack} className="gl-detail-back">← Back</button>
        <div className="gl-detail-error">No rounds found for {decoded}.</div>
      </div>
    );
  }

  // Filter to the requested side if applicable
  const rounds = (side && !is9Hole)
    ? allRounds.filter(r => r.frontBack === side)
    : allRounds;

  const par = rounds[0]?.coursePar;
  const history = [...rounds].sort(
    (a, b) => new Date(b.datePlayed).getTime() - new Date(a.datePlayed).getTime()
  );
  const players = countBy(rounds, r => r.player);

  // Course info metadata
  const info = sessionCache.courseInfo?.courses.find(c => c.name === decoded);

  // Header title
  const headingTitle = side ? `${decoded} — ${side} 9` : decoded;

  // Notable rounds — split by side for 18-hole without a side filter
  const showSplitNotable = !is9Hole && !side;
  const frontRounds = allRounds.filter(r => r.frontBack === 'Front');
  const backRounds  = allRounds.filter(r => r.frontBack === 'Back');

  return (
    <div className="gl-detail-wrapper">
      <div className="gl-detail-header">
        <button onClick={goBack} className="gl-detail-back">← Back</button>
        <h1 className="cd-name">{headingTitle}</h1>
        {info?.fullName && info.fullName !== decoded && (
          <p className="cd-fullname">{info.fullName}</p>
        )}
        <p className="cd-meta">
          Par {par} · {rounds.length} round{rounds.length !== 1 ? 's' : ''}
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
            </div>
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
                      scoreCell={r => <>{r.score} ({formatPlusMinus(r.plusMinus)})</>}
                    />
                    <NotableCol
                      label="Low Net"
                      rounds={topRoundsByNet(frontRounds)}
                      scoreCell={r => <>{r.netScore} net ({formatPlusMinus(r.plusMinus)})</>}
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
                      scoreCell={r => <>{r.score} ({formatPlusMinus(r.plusMinus)})</>}
                    />
                    <NotableCol
                      label="Low Net"
                      rounds={topRoundsByNet(backRounds)}
                      scoreCell={r => <>{r.netScore} net ({formatPlusMinus(r.plusMinus)})</>}
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="cd-notable-grid">
              <NotableCol
                label="Low Gross"
                rounds={topRoundsByGross(rounds)}
                scoreCell={r => <>{r.score} ({formatPlusMinus(r.plusMinus)})</>}
              />
              <NotableCol
                label="Low Net"
                rounds={topRoundsByNet(rounds)}
                scoreCell={r => <>{r.netScore} net ({formatPlusMinus(r.plusMinus)})</>}
              />
            </div>
          )}
        </section>

        {/* Frequent Players */}
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

        {/* Round History */}
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Round History</h2>
          {history.map((r, i) => (
            <div key={i} className="cd-round-row">
              <span className="cd-round-date">{formatDate(r.datePlayed)}</span>
              <Link
                to={`/golf-leaderboard/player/${encodeURIComponent(r.player)}`}
                className="cd-player-link cd-round-player"
              >
                {r.player}
              </Link>
              {r.tees && <span className="cd-round-tees">{r.tees}</span>}
              {!is9Hole && r.frontBack && (
                <span className="cd-round-fb">{r.frontBack}</span>
              )}
              <span className={`cd-round-scores ${pmScoreClass(r.plusMinus)}`}>
                {r.score} / {r.netScore} ({formatPlusMinus(r.plusMinus)})
              </span>
              <span className="cd-round-hcp">HCP {r.playingHandicap}</span>
            </div>
          ))}
        </section>

      </div>
    </div>
  );
}
