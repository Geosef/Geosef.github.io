import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import './GolfLeaderboard.css';
import './EventDetail.css';
import { getEvent } from './eventsData';

const RANK_CLASS = ['ev-rank--1', 'ev-rank--2', 'ev-rank--3'];

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const event = getEvent(eventId);

  function goBack() {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/golf-leaderboard');
    }
  }

  if (!event) {
    return (
      <div className="gl-detail-wrapper">
        <div className="gl-detail-header">
          <button onClick={goBack} className="gl-detail-back"><ArrowLeft size={16} /> Back</button>
        </div>
        <div className="gl-detail-error">Event not found.</div>
      </div>
    );
  }

  const { name, tagline, history, format, pastWinners, latestResult } = event;

  return (
    <div className="gl-detail-wrapper">
      <div className="gl-detail-header">
        <button onClick={goBack} className="gl-detail-back"><ArrowLeft size={16} /> Back</button>
        <h1 className="ev-name">{name}</h1>
        <p className="ev-tagline">{tagline}</p>
      </div>

      <div className="gl-detail-content">
        {/* About */}
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">About</h2>
          {history.map((p, i) => (
            <p key={i} className="ev-paragraph">{p}</p>
          ))}
          {format && (
            <p className="ev-format"><span className="ev-format-label">Format</span> {format}</p>
          )}
        </section>

        {/* Latest points scorers (post-event) */}
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">
            {latestResult ? `${latestResult.year} Points` : 'Points'}
          </h2>
          {latestResult ? (
            <>
              {latestResult.played && <p className="ev-result-meta">{latestResult.played}</p>}
              <div className="ev-scorers">
                {latestResult.scorers.map(s => (
                  <div key={`${s.rank}-${s.name}`} className="ev-scorer-row">
                    <span className={`ev-rank ${RANK_CLASS[s.rank - 1] ?? ''}`}>{s.rank}</span>
                    <span className="ev-scorer-info">
                      <Link
                        to={`/golf-leaderboard/player/${encodeURIComponent(s.name)}`}
                        className="cd-player-link"
                      >
                        {s.name}
                      </Link>
                      {s.note && <span className="ev-scorer-note">{s.note}</span>}
                    </span>
                    <span className="ev-scorer-points">{Math.round(s.points)} pts</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="gl-detail-empty">Results will be posted here after this year’s event.</p>
          )}
        </section>

        {/* Past winners (evergreen) */}
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">Past Winners</h2>
          {pastWinners.length > 0 ? (
            <div className="ev-winners">
              {pastWinners.map(w => (
                <div key={w.year} className="ev-winner-row">
                  <span className="ev-winner-year">{w.year}</span>
                  <span className="ev-winner-info">
                    <span className="ev-winner-champ">
                      <Trophy size={13} className="ev-winner-trophy" /> {w.champion}
                    </span>
                    {w.runnerUp && <span className="ev-winner-runner">def. {w.runnerUp}</span>}
                    {w.note && <span className="ev-winner-note">{w.note}</span>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="gl-detail-empty">No past winners recorded yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
