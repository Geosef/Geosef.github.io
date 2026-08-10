import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Trophy, Flag, Users, Scissors } from 'lucide-react';
import './GolfLeaderboard.css';
import './EventDetail.css';
import './Playoffs.css';
import type { Standing } from '../../types/golf';
import { formatPlusMinus } from '../../types/golf';
import { sessionCache, loadAction } from '../../golf-cache';
import { pmScoreClass, StickyListHeader, cutLineIndex, CUT_LINE_RANK } from './leaderboard-utils';
import { SkeletonLine } from './GolfSkeleton';

const VENUE_COURSE = 'The Quarry';

/** Survivors of the 18-hole cut who play the afternoon round. */
const CUT_TO = 24;

/** Seeds 1–4 start here; each group of four after them starts a stroke higher. */
const TOP_SEED_SCORE = -9;
const GROUP_SIZE = 4;
/** Positions shown just outside the cut. */
const BUBBLE_SIZE = 8;

/** Confirmed champions, most recent first. */
const PAST_WINNERS: { year: number; champion: string }[] = [
  { year: 2025, champion: 'Brad Weissler' },
];

interface Group {
  score: number;
  from: number;
  players: Standing[];
}

/**
 * Split the qualifying field into its starting-score groups: four players per
 * stroke from -9 up, then everyone remaining together at even par. Driven off
 * the live field rather than a fixed 52 so a tie at the cut just widens the
 * even-par group.
 */
function startingGroups(qualifiers: Standing[]): Group[] {
  const groups: Group[] = [];
  let from = 0;
  for (let score = TOP_SEED_SCORE; score < 0; score++) {
    const players = qualifiers.slice(from, from + GROUP_SIZE);
    if (players.length) groups.push({ score, from: from + 1, players });
    from += GROUP_SIZE;
  }
  const evenPar = qualifiers.slice(from);
  if (evenPar.length) groups.push({ score: 0, from: from + 1, players: evenPar });
  return groups;
}

function PlayerName({ name }: { name: string }) {
  return (
    <Link
      to={`/golf-leaderboard/player/${encodeURIComponent(name)}`}
      className="cd-player-link"
    >
      {name}
    </Link>
  );
}

export default function Playoffs() {
  const [season, setSeason] = useState(sessionCache.season);
  const [loading, setLoading] = useState(!sessionCache.season);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (sessionCache.season) return;
    loadAction('season')
      .then(setSeason)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const standings = season?.standings ?? [];
  const cutAt = cutLineIndex(standings);
  const fieldEnd = cutAt === -1 ? standings.length : cutAt;
  const qualifiers = standings.slice(0, fieldEnd);
  const groups = startingGroups(qualifiers);
  const bubble = cutAt === -1 ? [] : standings.slice(cutAt, cutAt + BUBBLE_SIZE);
  const cutPoints = fieldEnd > 0 ? standings[fieldEnd - 1].points : 0;

  return (
    <div className="gl-wrapper">
      <StickyListHeader title="League Playoffs" />

      <div className="gl-content">
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Details</h2>
          <div className="ev-details">
            <div className="ev-detail-row">
              <MapPin size={15} className="ev-detail-icon" />
              <span className="ev-detail-label">Where</span>
              <Link
                to={`/golf-leaderboard/course/${encodeURIComponent(VENUE_COURSE)}`}
                className="ev-detail-link"
              >
                {VENUE_COURSE}
              </Link>
            </div>
            <div className="ev-detail-row">
              <Calendar size={15} className="ev-detail-icon" />
              <span className="ev-detail-label">When</span>
              <span className="ev-detail-value">Sunday, September 13</span>
            </div>
            <div className="ev-detail-row">
              <Trophy size={15} className="ev-detail-icon" />
              <span className="ev-detail-label">What</span>
              <span className="ev-detail-value">36-hole championship</span>
            </div>
            <div className="ev-detail-row">
              <Flag size={15} className="ev-detail-icon" />
              <span className="ev-detail-label">Tees</span>
              <span className="ev-detail-value">Gold</span>
            </div>
            <div className="ev-detail-row">
              <Users size={15} className="ev-detail-icon" />
              <span className="ev-detail-label">Field</span>
              <span className="ev-detail-value">Top {CUT_LINE_RANK} plus ties</span>
            </div>
            <div className="ev-detail-row">
              <Scissors size={15} className="ev-detail-icon" />
              <span className="ev-detail-label">Cut</span>
              <span className="ev-detail-value">Top {CUT_TO} after 18 holes</span>
            </div>
          </div>
        </section>

        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Format</h2>
          <ol className="pl-steps">
            <li className="pl-step">
              <span className="pl-step-round">Morning</span>
              <span className="pl-step-text">Full field plays 18 holes.</span>
            </li>
            <li className="pl-step">
              <span className="pl-step-round">Cut</span>
              <span className="pl-step-text">Top {CUT_TO} advance.</span>
            </li>
            <li className="pl-step">
              <span className="pl-step-round">Afternoon</span>
              <span className="pl-step-text">
                Second 18 decides the championship.
              </span>
            </li>
          </ol>
          <p className="pl-note">
            Starting scores carry over from the regular season — see the groupings below.
          </p>
        </section>

        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Groupings</h2>
          <p className="pl-note">
            Projected from the current <Link to="/golf-leaderboard" className="ev-detail-link">standings</Link>.
            Final seeding is set when the regular season ends.
          </p>

          {loading ? (
            <div className="pl-loading">
              <SkeletonLine width="45%" />
              <SkeletonLine width="70%" />
              <SkeletonLine width="60%" />
            </div>
          ) : failed || groups.length === 0 ? (
            <p className="gl-detail-empty">Standings unavailable right now.</p>
          ) : (
            <div className="pl-groups">
              {groups.map(g => (
                <div
                  key={g.score}
                  /* The even-par group holds everyone left, so it runs far
                     longer than the four-player groups and gets its own row. */
                  className={`pl-group${g.players.length > GROUP_SIZE ? ' pl-group--wide' : ''}`}
                >
                  <div className="pl-group-head">
                    <span className={`pl-group-score ${pmScoreClass(g.score)}`}>
                      {formatPlusMinus(g.score)}
                    </span>
                    <span className="pl-group-seeds">
                      {g.players.length > 1
                        ? `${g.from}–${g.from + g.players.length - 1}`
                        : `${g.from}`}
                    </span>
                  </div>
                  <ol className="pl-group-players">
                    {g.players.map((p, i) => (
                      <li key={p.name} className="pl-group-player">
                        <span className="pl-seed">{g.from + i}</span>
                        <PlayerName name={p.name} />
                        <span className="pl-player-points">{Math.round(p.points)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </section>

        {!loading && !failed && bubble.length > 0 && (
          <section className="gl-detail-section">
            <h2 className="gl-detail-section-title">On the Bubble</h2>
            <p className="pl-note">
              Next {bubble.length} out, with the points each needs to reach the cut.
            </p>
            <ol className="pl-bubble">
              {bubble.map(p => (
                <li key={p.name} className="pl-bubble-row">
                  <span className="pl-seed">{p.isTied ? `T${p.rank}` : p.rank}</span>
                  <span className="pl-bubble-name">
                    <PlayerName name={p.name} />
                  </span>
                  <span className="pl-bubble-back">
                    +{Math.round(cutPoints - p.points)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Past Champions</h2>
          <div className="ev-winners">
            {PAST_WINNERS.map(w => (
              <div key={w.year} className="ev-winner-row">
                <span className="ev-winner-year">{w.year}</span>
                <span className="ev-winner-info">
                  <span className="ev-winner-champ">
                    <Trophy size={13} className="ev-winner-trophy" />
                    <PlayerName name={w.champion} />
                  </span>
                </span>
              </div>
            ))}
          </div>
          <p className="pl-note">Earlier champions to be added.</p>
        </section>
      </div>
    </div>
  );
}
