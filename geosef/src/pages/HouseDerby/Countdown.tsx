import React, { useEffect, useState } from 'react';
import { teeClock, type Session } from './data';
import { groupIds, groupSessions } from './lineups';
import { SURFACES, useWakeLock } from './display';
import { useCupChrome } from './brand';
import Logo from './Logo';

// Not a stage, so not in sessions.json.
const CLOSING = { at: '2026-10-17T18:00:00-05:00', label: 'Closing ceremony & trophy' };

const EVENT_TZ = 'America/Chicago';
const dayName = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: EVENT_TZ });

/** The weekend in order: each stage's first tee and each matchup announcement. */
export function schedule(sessions: Session[]): Array<{ at: string; label: string; kind: 'tee' | 'announce' | 'ceremony' }> {
  const items = [
    ...sessions.filter(s => s.startsAt).map(s => ({ at: s.startsAt!, label: s.name, kind: 'tee' as const })),
    ...groupIds(sessions).flatMap(g => {
      const stages = groupSessions(sessions, g);
      const at = stages[0].announceAt;
      // A group of stages is one day's ("Friday matchups"); otherwise the stage's.
      const what = stages.length > 1 ? (stages[0].day === 'fri' ? 'Friday' : 'Saturday') : stages[0].name;
      return at ? [{ at, label: `${what} matchups announced`, kind: 'announce' as const }] : [];
    }),
    { ...CLOSING, kind: 'ceremony' as const },
  ];
  return items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** Days, hours, minutes, seconds until `at`, ticking each second. */
function useRemaining(at: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((at - now) / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor(s / 3600) % 24, minutes: Math.floor(s / 60) % 60, seconds: s % 60 };
}

/**
 * What the public sees before the board goes live: the crest, a clock to the
 * first tee and the weekend's schedule. Same page on a phone and on a TV.
 */
export default function Countdown({ sessions, firstTee }: { sessions: Session[]; firstTee: string }) {
  useCupChrome('House Derby', SURFACES.tv, '/cup/tv.webmanifest');
  // A clubhouse TV left on the countdown (?tv) shouldn't sleep before go-time.
  useWakeLock(new URLSearchParams(window.location.search).has('tv'));
  const left = useRemaining(Date.parse(firstTee));
  const items = schedule(sessions);
  const days = [...new Set(items.map(i => dayName(i.at)))];
  const units: Array<[number, string]> = [[left.days, 'Days'], [left.hours, 'Hours'], [left.minutes, 'Min'], [left.seconds, 'Sec']];

  return (
    <div className="hd-page hd-countdown-page">
      <Logo name="crest" className="hd-cd-crest" label="Gimme House Derby" />
      <div className="hd-cd-teams">
        <span className="og">OG House</span><span className="v">vs</span><span className="south">South House</span>
      </div>
      <div className="hd-cd-clock" role="timer" aria-label={`${left.days} days, ${left.hours} hours, ${left.minutes} minutes until first tee`}>
        {units.map(([v, label]) => (
          <div key={label} className="hd-cd-unit">
            <span className="hd-cd-num">{String(v).padStart(2, '0')}</span>
            <span className="hd-cd-label">{label}</span>
          </div>
        ))}
      </div>
      <p className="hd-cd-until">until the first tee</p>
      <section className="hd-cd-schedule" aria-label="Schedule">
        {days.map(day => (
          <div key={day} className="hd-cd-day">
            <h2>{day}</h2>
            <ul>
              {items.filter(i => dayName(i.at) === day).map(i => (
                <li key={i.at + i.label} className={i.kind}>
                  <span className="hd-cd-time">{teeClock(i.at)}</span>
                  <span>{i.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <footer className="hd-cd-foot">
        <Logo name="ggc" className="hd-foot-logo" />
        <span>Gimme Golf Club</span>
      </footer>
    </div>
  );
}
