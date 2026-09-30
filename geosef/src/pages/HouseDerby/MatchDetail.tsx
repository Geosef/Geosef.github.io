import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { FORMAT_NAMES, TEAM_NAMES, matchName, nineName, sideFullName, useMatch, useMatches, usePlayers, useSessions } from './data';
import ShareSheet from './ShareSheet';
import { TEAMS, holeOutcome, matchStates, segments, strokesOn } from './scoring';
import { useCupChrome } from './brand';
import Logo from './Logo';
import './HouseDerby.css';

export default function MatchDetail() {
  const { matchId = '' } = useParams();
  const { match, error } = useMatch(matchId);
  const { byId } = usePlayers();
  const { sessions } = useSessions();
  // Every match, for the cup score on the share card.
  const { matches } = useMatches();
  const [sharing, setSharing] = useState(false);
  useCupChrome();

  const back = <Link to="/cup" className="hd-back">‹ Scoreboard</Link>;
  if (error) return <div className="hd-page">{back}<p className="hd-error">{error}</p></div>;
  if (match === undefined) return <div className="hd-page"><p className="hd-muted">Loading…</p></div>;
  if (match === null) return <div className="hd-page">{back}<p className="hd-error">Match not found.</p></div>;

  const session = sessions?.find(s => s.id === match.session);
  const states = matchStates(match);
  const segs = segments(match);

  return (
    <div className="hd-page hd-detail">
      <div className="hd-entry-head">
        {back}
        {matches && (
          <button type="button" className="hd-tv-link" onClick={() => setSharing(true)}><Share2 aria-hidden />Share</button>
        )}
      </div>
      <div className="hd-muted">
        {session ? `${session.day === 'fri' ? 'Friday' : 'Saturday'} · ${session.name} · ${FORMAT_NAMES[session.format] ?? session.format}` : match.session}
        {` · ${matchName(match)}`}
      </div>
      <div className="hd-detail-sides">
        {TEAMS.map(t => (
          <div key={t} className={`hd-detail-side ${t}`}>
            <span className="hd-detail-team">
              <Logo name={t} className="hd-team-logo" />
              {TEAM_NAMES[t]}
            </span>
            <span>{sideFullName(match, t, byId)}</span>
          </div>
        ))}
      </div>

      {segs.map((seg, i) => {
        const state = states[i];
        const lead = state.phase === 'final' ? state.winner : state.leader;
        return (
          <section key={i} className="hd-nine">
            <div className="hd-nine-head">
              <span>{nineName(match) || 'Holes'}</span>
              <span className={`hd-status ${lead ?? 'even'}`}>
                {lead && state.phase !== 'not-started' ? `${TEAM_NAMES[lead]} ` : ''}
                {state.phase === 'final' && !state.winner ? 'Halved' : state.label}
              </span>
            </div>
            <table className="hd-grid">
              <thead>
                <tr>
                  <th scope="col">Hole</th>
                  {seg.map(h => <th key={h} scope="col">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {TEAMS.map(t => (
                  <tr key={t} className={t}>
                    <th scope="row">{t === 'og' ? 'OG' : 'South'}</th>
                    {seg.map(h => {
                      const o = holeOutcome(match, h);
                      const strokes = strokesOn(match, t, h);
                      const after = state.afterClose.includes(h);
                      return (
                        <td
                          key={h}
                          className={`${o === t ? 'won' : o === 'halved' ? 'halved' : ''} ${after ? 'after-close' : ''}`}
                          aria-label={`Hole ${h}: ${o === t ? 'won' : o === 'halved' ? 'halved' : o ? 'lost' : 'not played'}${strokes ? `, ${strokes} stroke${strokes > 1 ? 's' : ''}` : ''}`}
                        >
                          {o === t ? 'W' : o === 'halved' ? '–' : ''}
                          {strokes > 0 && <span className="hd-grid-stroke">{'•'.repeat(strokes)}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      <p className="hd-muted">• marks a stroke hole. Faded holes were played after the nine was decided.</p>
      {sharing && matches && (
        <ShareSheet onClose={() => setSharing(false)} options={[{ label: matchName(match), spec: { kind: 'match', match, session, matches, byId } }]} />
      )}
    </div>
  );
}
