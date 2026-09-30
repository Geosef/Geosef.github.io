import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { fmtPoints, useMatches, useSessions } from './data';
import { CupLink, vtName } from './nav';
import { MomentumView } from './Segments';
import ShareSheet from './ShareSheet';
import CupSplash from './CupSplash';
import { TOTAL_POINTS, cupStanding, type TeamId } from './scoring';
import { useCupChrome } from './brand';
import './HouseDerby.css';

/**
 * The race to 18 on a phone: the TV segment (points bar and running totals)
 * in a phone-shaped frame, with the share card one tap away.
 */
export default function RacePage() {
  const { sessions, error: sErr } = useSessions();
  const { matches, error: mErr } = useMatches();
  const [sharing, setSharing] = useState(false);
  useCupChrome(`Race to ${TOTAL_POINTS / 2} · House Derby`);

  const error = sErr ?? mErr;
  if (error) return <div className="hd-page"><p className="hd-error">{error}</p></div>;
  if (!sessions || !matches) return <CupSplash />;

  return (
    <div className="hd-page hd-race-page">
      <div className="hd-entry-head">
        <CupLink to="/cup" className="hd-back">‹ Scoreboard</CupLink>
        <button type="button" className="hd-tv-link" onClick={() => setSharing(true)}><Share2 aria-hidden />Share</button>
      </div>
      {/* A size container, like the TV body, so the segment's cq sizing applies. */}
      <div className="hd-seg-host hd-race-frame" style={vtName('race')}>
        <MomentumView sessions={sessions} matches={matches} />
      </div>
      {sharing && (
        <ShareSheet
          onClose={() => setSharing(false)}
          options={[{ label: `Race to ${TOTAL_POINTS / 2}`, spec: { kind: 'race', sessions, matches }, clip: '/cup?tv&replay=race' }]}
        />
      )}
    </div>
  );
}

/**
 * One-glance race on the phone board: the 36-point bar (won solid, leading
 * striped, gold winning line). Opens the full race.
 */
export function RaceStrip({ standing }: { standing: ReturnType<typeof cupStanding> }) {
  const pct = (n: number) => `${(n / TOTAL_POINTS) * 100}%`;
  const lead = (t: TeamId) => Math.max(0, standing.projected[t] - standing.points[t]);
  const left = TOTAL_POINTS - standing.points.og - standing.points.south;
  return (
    <CupLink to="/cup/race" className="hd-race-strip" style={vtName('race')} aria-label={`Race to ${TOTAL_POINTS / 2}: ${fmtPoints(left)} points left to play`}>
      <span className="hd-race-strip-head">
        <span>Race to {TOTAL_POINTS / 2}</span>
        <span className="hd-muted">{fmtPoints(left)} to play ›</span>
      </span>
      <span className="hd-race-bar hd-race-strip-bar">
        <span className="won og" style={{ left: 0, width: pct(standing.points.og) }} />
        <span className="lead og" style={{ left: pct(standing.points.og), width: pct(lead('og')) }} />
        <span className="won south" style={{ right: 0, width: pct(standing.points.south) }} />
        <span className="lead south" style={{ right: pct(standing.points.south), width: pct(lead('south')) }} />
        <span className="hd-race-line" />
      </span>
    </CupLink>
  );
}
