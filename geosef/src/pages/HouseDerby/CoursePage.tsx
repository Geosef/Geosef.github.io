import React from 'react';
import { useParams } from 'react-router-dom';
import { formatLabel, teeClock, useSessions, type Session } from './data';
import { COURSES, courseById, totals, type Hole } from './courses';
import { CupLink } from './nav';
import CupSplash from './CupSplash';
import { useCupChrome } from './brand';
import './HouseDerby.css';

/** A course: what it is, its scorecard, and the Derby stages played on it. */
export default function CoursePage() {
  const { courseId } = useParams();
  const course = courseById(courseId);
  const { sessions } = useSessions();
  useCupChrome(course ? `${course.name} · House Derby` : 'House Derby');

  if (!course) return <div className="hd-page"><CupLink to="/cup" className="hd-back">‹ Scoreboard</CupLink><p className="hd-error">Course not found.</p></div>;
  if (!sessions) return <CupSplash />;

  const here = sessions.filter(s => s.course === course.id);
  const all = totals(course.holes);
  const nines = course.holes.length > 9 ? [course.holes.slice(0, 9), course.holes.slice(9)] : [course.holes];
  const other = COURSES.find(c => c.id !== course.id);

  return (
    <div className="hd-page hd-course">
      <div className="hd-entry-head">
        <CupLink to="/cup" className="hd-back">‹ Scoreboard</CupLink>
        {other && <CupLink to={`/cup/course/${other.id}`} className="hd-tv-link">{other.name} ›</CupLink>}
      </div>

      <header className="hd-course-head">
        <h1>{course.name}</h1>
        <span className="hd-course-where">{course.location}</span>
        {course.playedAt && <span className="hd-course-played">{course.playedAt}</span>}
        <div className="hd-course-stats">
          <span><b>{all.par}</b>Par</span>
          <span><b>{all.yards.toLocaleString('en-US')}</b>Yards</span>
          <span><b>{course.tees}</b>Tees</span>
          {course.rating && <span><b>{course.rating}/{course.slope}</b>Rating</span>}
        </div>
      </header>

      <p className="hd-course-about">{course.about}</p>

      {here.length > 0 && (
        <section className="hd-player-section">
          <h2>Derby stages here</h2>
          <ul className="hd-course-stages">
            {here.map(s => <StageLine key={s.id} session={s} />)}
          </ul>
        </section>
      )}

      <section className="hd-player-section">
        <h2>Scorecard</h2>
        {nines.map((nine, i) => <Nine key={i} holes={nine} label={nines.length > 1 ? (i ? 'In' : 'Out') : 'Total'} />)}
        {nines.length > 1 && (
          <div className="hd-scorecard-total"><span>Total</span><span>{all.par}</span><span>{all.yards.toLocaleString('en-US')}</span><span /></div>
        )}
      </section>
    </div>
  );
}

function StageLine({ session }: { session: Session }) {
  return (
    <li>
      <span className="hd-course-stage">{session.day === 'fri' ? 'Friday' : 'Saturday'} · {session.name}</span>
      <span className="hd-muted">
        {[formatLabel(session) !== session.name && formatLabel(session), session.startsAt && teeClock(session.startsAt)].filter(Boolean).join(' · ')}
      </span>
    </li>
  );
}

/** One nine, a row per hole (reads down a phone rather than across). */
function Nine({ holes, label }: { holes: Hole[]; label: string }) {
  const t = totals(holes);
  return (
    <table className="hd-scorecard">
      <thead>
        <tr><th scope="col">Hole</th><th scope="col">Par</th><th scope="col">Yards</th><th scope="col">SI</th></tr>
      </thead>
      <tbody>
        {holes.map(h => (
          <tr key={h.hole}><th scope="row">{h.hole}</th><td>{h.par}</td><td>{h.yards}</td><td>{h.si}</td></tr>
        ))}
      </tbody>
      <tfoot>
        <tr><th scope="row">{label}</th><td>{t.par}</td><td>{t.yards.toLocaleString('en-US')}</td><td /></tr>
      </tfoot>
    </table>
  );
}
