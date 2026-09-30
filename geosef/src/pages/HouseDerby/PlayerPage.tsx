import React from 'react';
import { useParams } from 'react-router-dom';
import {
  TEAM_NAMES, matchSort, nineName, sideName, teeClock, useMatches, usePlayerPhotos, usePlayers, useSessions,
  type Match, type Player, type Session,
} from './data';
import { accolades, topFirsts } from './merit';
import { CupLink, vtName } from './nav';
import { matchStates, type TeamId } from './scoring';
import { useCupChrome } from './brand';
import Logo from './Logo';
import Portrait from './Portrait';
import CupSplash from './CupSplash';
import './HouseDerby.css';

/** One player: photo hero, their Derby matches, and their season. */
export default function PlayerPage() {
  const { playerId = '' } = useParams();
  const { players, byId, error: pErr } = usePlayers();
  const { matches, error: mErr } = useMatches();
  const { sessions } = useSessions();
  const photos = usePlayerPhotos([playerId]);
  const player = byId.get(playerId);
  useCupChrome(player ? `${player.first} ${player.last} · House Derby` : 'House Derby');

  const error = pErr ?? mErr;
  if (error) return <div className="hd-page"><p className="hd-error">{error}</p></div>;
  if (!players || !matches || !sessions) return <CupSplash />;
  if (!player) return <div className="hd-page"><CupLink to="/cup" className="hd-back">‹ Scoreboard</CupLink><p className="hd-error">Player not found.</p></div>;

  const team = player.team;
  const theirs = [...matches].filter(m => m.players[team].includes(player.id)).sort(matchSort(sessions));
  const a = accolades(player.merit, topFirsts(players.map(p => p.merit)));

  return (
    <div className="hd-page hd-player-page">
      <div className="hd-entry-head">
        <CupLink to={`/cup/team/${team}`} className="hd-back">‹ {TEAM_NAMES[team]}</CupLink>
        <CupLink to="/cup" className="hd-tv-link">Scoreboard</CupLink>
      </div>

      <header className={`hd-player-hero ${team}`}>
        <Portrait player={player} team={team} photo={photos.get(player.id)} className="hd-player-hero-portrait" style={vtName(`player-${player.id}`)} />
        <div className="hd-player-hero-text">
          <CupLink to={`/cup/team/${team}`} className="hd-player-hero-team"><Logo name={team} className="hd-player-hero-logo" />{TEAM_NAMES[team]} ›</CupLink>
          {player.captain && <span className="hd-captain">Captain</span>}
          <span className="hd-player-first">{player.first}</span>
          <span className="hd-player-hero-last">{player.last}</span>
        </div>
      </header>

      {theirs.length > 0 && (
        <section className="hd-player-section">
          <h2>House Derby</h2>
          <div className="hd-player-derby">
            {theirs.map(m => <DerbyRow key={m.id} match={m} player={player} byId={byId} session={sessions.find(s => s.id === m.session)} />)}
          </div>
        </section>
      )}

      {(a.finishes.length > 0 || a.qualifiers.length > 0) && (
        <section className="hd-player-section">
          <h2>2026 season</h2>
          <ul className="hd-player-season">
            {a.finishes.map(f => (
              <li key={`${f.event}${f.label}`} className={f.place <= 3 ? `podium p${f.place}` : ''}>
                <span className="hd-season-place">{f.label}</span>
                <span className="hd-season-event">{f.event}</span>
              </li>
            ))}
            {a.qualifiers.map(q => (
              <li key={q.event}>
                <span className="hd-season-place">{q.label}</span>
                <span className="hd-season-event">{q.event}</span>
              </li>
            ))}
          </ul>
          {a.participation.length > 0 && (
            <p className="hd-player-also">
              Also played: {a.participation.map(p => (p.times > 1 ? `${p.event} ×${p.times}` : p.event)).join(' · ')}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * One Derby match from the player's side: where, with and against whom, and
 * how it went (or when it tees off). Opens the match.
 */
function DerbyRow({ match, player, byId, session }: { match: Match; player: Player; byId: Map<string, Player>; session?: Session }) {
  const team = player.team;
  const them: TeamId = team === 'og' ? 'south' : 'og';
  const st = matchStates(match)[0];
  const lead = st.phase === 'final' ? st.winner : st.leader;
  const us = lead === team;
  const result =
    st.phase === 'not-started' ? (match.teeTime ? teeClock(match.teeTime) : '–')
    : st.phase === 'final' ? (st.winner === null ? '½' : `${us ? 'W' : 'L'} ${st.label.replace(' ', '')}`)
    : lead === null ? `AS · ${st.thru}` : `${st.up} ${us ? 'UP' : 'DN'} · ${st.thru}`;
  const tone = st.phase === 'not-started' ? 'idle' : lead === null ? 'even' : us ? 'up' : 'down';
  const partners = match.players[team].filter(id => id !== player.id).map(id => byId.get(id)?.last ?? id);
  return (
    <CupLink to={`/cup/match/${match.id}`} className={`hd-derby-row ${team} ${tone}`} style={vtName(`match-${match.id}`)}>
      <span className="hd-derby-where">
        <b>{[session?.name, nineName(match)].filter(Boolean).join(' · ')}</b>
        <span>{partners.length ? `with ${partners.join(', ')} · ` : ''}vs {sideName(match, them, byId)}</span>
      </span>
      <span className={`hd-derby-result ${st.phase === 'live' ? 'live' : ''}`}>{result}</span>
    </CupLink>
  );
}
