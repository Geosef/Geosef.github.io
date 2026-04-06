import { Link } from 'react-router-dom';
import type { Round } from '../../types/golf';
import { formatPlusMinus, formatDate } from '../../types/golf';
import { pmScoreClass } from './leaderboard-utils';

export function RoundRow({ round, linkCourse }: { round: Round; linkCourse?: boolean }) {
  return (
    <div className={`gl-round-row ${round.counts ? 'gl-round-counting' : 'gl-round-other'}`}>
      <span className="gl-round-check">{round.counts ? '✓' : '·'}</span>
      <span className="gl-round-date">{formatDate(round.datePlayed)}</span>
      <span className="gl-round-course">
        {linkCourse ? (
          <Link
            to={`/golf-leaderboard/course/${encodeURIComponent(round.course)}`}
            className="gl-round-course-link"
          >
            {round.course}
          </Link>
        ) : round.course}
        {round.tees ? ` (${round.tees})` : ''}
      </span>
      <span className={`gl-round-scores ${pmScoreClass(round.plusMinus)}`}>
        {round.score} / {round.netScore} ({formatPlusMinus(round.plusMinus)})
      </span>
      <span className="gl-round-hcp">HCP {round.playingHandicap}</span>
      {round.partner && <span className="gl-round-partner">w/ {round.partner}</span>}
    </div>
  );
}

export function RoundMonthGroup({
  month,
  rounds,
  monthlyCount,
  linkCourse,
}: {
  month: string;
  rounds: Round[];
  monthlyCount: number;
  linkCourse?: boolean;
}) {
  const countingCount = rounds.filter(r => r.counts).length;
  return (
    <div className="gl-round-group">
      <div className="gl-round-group-header">
        {month}
        <span className="gl-round-group-meta">
          · {countingCount} of {monthlyCount} round{monthlyCount !== 1 ? 's' : ''} count
        </span>
      </div>
      {rounds.map((r, i) => <RoundRow key={i} round={r} linkCourse={linkCourse} />)}
    </div>
  );
}
