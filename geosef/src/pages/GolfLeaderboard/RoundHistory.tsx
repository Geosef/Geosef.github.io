import { Link } from 'react-router-dom';
import type { Round } from '../../types/golf';
import { formatPlusMinus, formatDate } from '../../types/golf';
import { pmScoreClass, NON_MEMBER_PARTNER, lastName } from './leaderboard-utils';

export function RoundRow({ round }: { round: Round }) {
  const isRealPartner = round.partner && round.partner !== NON_MEMBER_PARTNER;

  return (
    <div className={`gl-round-row ${round.counts ? 'gl-round-counting' : 'gl-round-other'}`}>
      <div className="gl-round-left">
        <span className="gl-round-check">{round.counts ? '✓' : '·'}</span>
        <span className="gl-round-date">{formatDate(round.datePlayed)}</span>
        {round.partner && (
          <span className="gl-round-partner">
            w/{' '}
            {isRealPartner ? (
              <Link
                to={`/golf-leaderboard/player/${encodeURIComponent(round.partner)}`}
                className="gl-round-partner-link"
              >
                {lastName(round.partner)}
              </Link>
            ) : lastName(round.partner)}
          </span>
        )}
      </div>
      <span className="gl-round-course">
        <Link
          to={`/golf-leaderboard/course/${encodeURIComponent(round.course)}`}
          className="gl-round-course-link"
        >
          {round.course}
        </Link>
        {round.tees ? ` (${round.tees})` : ''}
      </span>
      <div className="gl-round-right">
        <span className={`gl-round-scores ${pmScoreClass(round.plusMinus)}`}>
          {round.score} / {round.netScore} ({formatPlusMinus(round.plusMinus)})
        </span>
        <span className="gl-round-hcp">HCP {round.playingHandicap}</span>
      </div>
    </div>
  );
}

export function RoundMonthGroup({
  month,
  rounds,
  monthlyCount,
}: {
  month: string;
  rounds: Round[];
  monthlyCount: number;
}) {
  return (
    <div className="gl-round-group">
      <div className="gl-round-group-header">
        {month}
        <span className="gl-round-group-meta">
          · {rounds.length} of 5 scoring rounds
        </span>
      </div>
      {rounds.map((r, i) => <RoundRow key={i} round={r} />)}
    </div>
  );
}
