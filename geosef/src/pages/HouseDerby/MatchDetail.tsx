import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { TEAM_NAMES, dayAndSession, formatLabel, matchHeadline, nineName, sideName, useMatch, useMatches, usePlayerPhotos, usePlayers, useSessions } from './data';
import Portrait from './Portrait';
import CupSplash from './CupSplash';
import { CupLink, vtName } from './nav';
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
  const photos = usePlayerPhotos(match ? [...match.players.og, ...match.players.south] : []);
  useCupChrome();

  const back = <CupLink to="/cup" className="hd-back">‹ Scoreboard</CupLink>;
  if (error) return <div className="hd-page">{back}<p className="hd-error">{error}</p></div>;
  if (match === undefined) return <CupSplash />;
  if (match === null) return <div className="hd-page">{back}<p className="hd-error">Match not found.</p></div>;

  const session = sessions?.find(s => s.id === match.session);
  const states = matchStates(match);
  const segs = segments(match);
  const headline = matchHeadline(match);

  return (
    <div className="hd-page hd-detail">
      <div className="hd-entry-head">
        {back}
        {matches && (
          <button type="button" className="hd-tv-link" onClick={() => setSharing(true)}><Share2 aria-hidden />Share</button>
        )}
      </div>
      {/* Hero: where it stands, then who's playing, with their photos. */}
      {/* Named to match its row on the board, so opening a match morphs the row into this. */}
      <section className="hd-mhero" style={vtName(`match-${match.id}`)}>
        <div className="hd-mhero-stage">
          {[session ? dayAndSession(session) : match.session, nineName(match), session && formatLabel(session)].filter(Boolean).join(' · ')}
        </div>
        <div className={`hd-mhero-status ${headline.team ?? (headline.final ? 'halved' : 'even')}`}>{headline.text}</div>
        <div className="hd-mhero-sides">
          {TEAMS.map(t => (
            <div key={t} className={`hd-mhero-side ${t}`}>
              <CupLink to={`/cup/team/${t}`} className="hd-mhero-team"><Logo name={t} className="hd-mhero-logo" />{TEAM_NAMES[t]} ›</CupLink>
              {match.players[t].length ? match.players[t].map(id => {
                const p = byId.get(id);
                return (
                  // Each player opens their page; the portrait morphs into its hero.
                  <CupLink key={id} to={`/cup/player/${id}`} className="hd-mhero-player">
                    <Portrait player={p} team={t} photo={photos.get(id)} className="hd-mhero-portrait" style={vtName(`player-${id}`)} />
                    <span className="hd-mhero-name"><span>{p?.first}</span><span>{p?.last ?? id}</span></span>
                  </CupLink>
                );
              }) : <div className="hd-mhero-player">TBD</div>}
            </div>
          ))}
        </div>
      </section>

      {segs.map((seg, i) => {
        const state = states[i];
        const lead = state.phase === 'final' ? state.winner : state.leader;
        return (
          <section key={i} className="hd-nine">
            <div className="hd-nine-head">
              <span>{nineName(match) || 'Holes'}</span>
              {/* The hero already says where a single nine stands. */}
              {segs.length > 1 && (
                <span className={`hd-status ${lead ?? 'even'}`}>
                  {lead && state.phase !== 'not-started' ? `${TEAM_NAMES[lead]} ` : ''}
                  {state.phase === 'final' && !state.winner ? 'Halved' : state.label}
                </span>
              )}
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
        <ShareSheet
          onClose={() => setSharing(false)}
          options={[{
            label: `${sideName(match, 'og', byId)} v ${sideName(match, 'south', byId)}`,
            spec: { kind: 'match', match, session, matches, byId },
            clip: states.some(s => s.phase === 'final') ? `/cup?tv&replay=${match.id}` : undefined,
          }]}
        />
      )}
    </div>
  );
}
