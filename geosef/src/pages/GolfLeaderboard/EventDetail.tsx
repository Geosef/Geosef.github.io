import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Trophy, MapPin, Calendar, Flag, ArrowUpRight } from 'lucide-react';
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

  const { name, tagline, logo, intro, history, venue, when, what, captains, pastWinners, latestResult } = event;

  const venueLink = venue?.websiteUrl
    ? { href: venue.websiteUrl, external: true }
    : venue?.courseName
      ? { href: `/golf-leaderboard/course/${encodeURIComponent(venue.courseName)}`, external: false }
      : null;

  return (
    <div className="gl-detail-wrapper">
      <div className="gl-detail-header">
        <button onClick={goBack} className="gl-detail-back"><ArrowLeft size={16} /> Back</button>
        <div className="ev-titlebar">
          {logo && <img src={logo} alt={`${name} logo`} className="ev-logo" />}
          <div>
            <h1 className="ev-name">{name}</h1>
            <p className="ev-tagline">{tagline}</p>
          </div>
        </div>
      </div>

      <div className="gl-detail-content">
        {/* About */}
        <section className="gl-detail-section">
          <h2 className="gl-detail-section-title">About</h2>
          {intro && <p className="ev-intro">{intro}</p>}
          {history.map((p, i) => (
            <p key={i} className="ev-paragraph">{p}</p>
          ))}
        </section>

        {/* Details: where / when / what */}
        {(venue || when || what) && (
          <section className="gl-detail-section">
            <h2 className="gl-detail-section-title">Details</h2>
            <div className="ev-details">
              {venue && (
                <div className="ev-detail-row">
                  <MapPin size={15} className="ev-detail-icon" />
                  <span className="ev-detail-label">Where</span>
                  {venueLink ? (
                    venueLink.external ? (
                      <a href={venueLink.href} target="_blank" rel="noopener noreferrer" className="ev-detail-link">
                        {venue.name} <ArrowUpRight size={13} />
                      </a>
                    ) : (
                      <Link to={venueLink.href} className="ev-detail-link">{venue.name}</Link>
                    )
                  ) : (
                    <span className="ev-detail-value">{venue.name}</span>
                  )}
                </div>
              )}
              {when && (
                <div className="ev-detail-row">
                  <Calendar size={15} className="ev-detail-icon" />
                  <span className="ev-detail-label">When</span>
                  <span className="ev-detail-value">{when}</span>
                </div>
              )}
              {what && (
                <div className="ev-detail-row">
                  <Flag size={15} className="ev-detail-icon" />
                  <span className="ev-detail-label">What</span>
                  <span className="ev-detail-value">{what}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Club captains (Captain's Cup) */}
        {captains && captains.length > 0 && (
          <section className="gl-detail-section">
            <h2 className="gl-detail-section-title">Club Captains</h2>
            <div className="ev-captains">
              {captains.map(c => (
                <Link
                  key={c}
                  to={`/golf-leaderboard/player/${encodeURIComponent(c)}`}
                  className="ev-captain"
                >
                  {c}
                </Link>
              ))}
            </div>
          </section>
        )}

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
                      <Trophy size={13} className="ev-winner-trophy" />
                      <Link
                        to={`/golf-leaderboard/player/${encodeURIComponent(w.champion)}`}
                        className="cd-player-link"
                      >
                        {w.champion}
                      </Link>
                    </span>
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
