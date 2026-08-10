import { Link } from 'react-router-dom';
import { MapPin, Calendar, Trophy, Flag } from 'lucide-react';
import './GolfLeaderboard.css';
import './EventDetail.css';
import './Playoffs.css';
import { formatPlusMinus } from '../../types/golf';
import { pmScoreClass, StickyListHeader } from './leaderboard-utils';

const VENUE_COURSE = 'The Quarry';

/** Qualifiers who tee it up in the morning round. */
const FIELD_SIZE = 52;
/** Survivors of the 18-hole cut who play the afternoon round. */
const CUT_TO = 24;

const TOP_SEED_SCORE = -9;
const GROUP_SIZE = 4;

interface StartingTier {
  from: number;
  to: number;
  score: number;
}

/**
 * Starting scores, FedEx-Cup style: the top four seeds begin at -9 and each
 * following group of four starts a stroke higher. Once the ladder reaches even
 * par, everyone left in the field starts there too.
 */
function startingTiers(): StartingTier[] {
  const tiers: StartingTier[] = [];
  for (let score = TOP_SEED_SCORE; score < 0; score++) {
    const group = score - TOP_SEED_SCORE;
    tiers.push({
      from: group * GROUP_SIZE + 1,
      to: (group + 1) * GROUP_SIZE,
      score,
    });
  }
  const lastRanked = tiers[tiers.length - 1].to;
  tiers.push({ from: lastRanked + 1, to: FIELD_SIZE, score: 0 });
  return tiers;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export default function Playoffs() {
  const tiers = startingTiers();

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
          </div>
        </section>

        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Qualifying</h2>
          <p className="ev-paragraph">
            The top {FIELD_SIZE} players in the overall standings qualify for the playoffs
            (plus anyone tied on points with {ordinal(FIELD_SIZE)}). The cut line is marked
            on the <Link to="/golf-leaderboard" className="ev-detail-link">Leader Board</Link>.
          </p>
        </section>

        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Format</h2>
          <ol className="pl-steps">
            <li className="pl-step">
              <span className="pl-step-round">Morning</span>
              <span className="pl-step-text">
                All {FIELD_SIZE} qualifiers play 18 holes.
              </span>
            </li>
            <li className="pl-step">
              <span className="pl-step-round">Cut</span>
              <span className="pl-step-text">
                The top {CUT_TO} advance.
              </span>
            </li>
            <li className="pl-step">
              <span className="pl-step-round">Afternoon</span>
              <span className="pl-step-text">
                Those {CUT_TO} play the second 18 for the championship.
              </span>
            </li>
          </ol>
        </section>

        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Starting Scores</h2>
          <p className="ev-paragraph">
            Like the PGA Tour’s FedEx Cup, you don’t start from scratch — you carry a
            head start based on where you finish the regular season. The top four seeds
            begin at {formatPlusMinus(TOP_SEED_SCORE)}, and each group of four after
            them starts a stroke higher until the ladder reaches even par.
          </p>
          <div className="pl-tiers">
            {tiers.map(t => (
              <div key={t.from} className="pl-tier">
                <span className="pl-tier-range">
                  {ordinal(t.from)}–{ordinal(t.to)}
                </span>
                <span className={`pl-tier-score ${pmScoreClass(t.score)}`}>
                  {formatPlusMinus(t.score)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
