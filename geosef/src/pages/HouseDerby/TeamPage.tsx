import React from 'react';
import { useParams } from 'react-router-dom';
import { TEAM_NAMES, fmtPoints, useMatches, usePlayerPhotos, usePlayers, type Player } from './data';
import { accolades, topFirsts } from './merit';
import { CupLink, vtName } from './nav';
import { cupStanding, type TeamId } from './scoring';
import { useCupChrome } from './brand';
import Logo from './Logo';
import Portrait from './Portrait';
import CupSplash from './CupSplash';
import './HouseDerby.css';

/** Captains first, then by season Order of Merit (the points aren't shown). */
export function rosterOrder(a: Player, b: Player): number {
  return Number(b.captain) - Number(a.captain) || (b.merit?.points ?? 0) - (a.merit?.points ?? 0) || a.last.localeCompare(b.last);
}

/**
 * A team's roster: one row per player (photo, name, captain, their best
 * season result), each opening the player's page.
 */
export default function TeamPage() {
  const { team: param } = useParams();
  const team: TeamId = param === 'south' ? 'south' : 'og';
  const other: TeamId = team === 'og' ? 'south' : 'og';
  const { players, error: pErr } = usePlayers();
  const { matches, error: mErr } = useMatches();
  const roster = (players ?? []).filter(p => p.team === team).sort(rosterOrder);
  const photos = usePlayerPhotos(roster.map(p => p.id));
  useCupChrome(`${TEAM_NAMES[team]} · House Derby`);

  const error = pErr ?? mErr;
  if (error) return <div className="hd-page"><p className="hd-error">{error}</p></div>;
  if (!players || !matches) return <CupSplash />;
  const standing = cupStanding(matches);
  const firsts = topFirsts(players.map(p => p.merit));

  return (
    <div className="hd-page hd-team">
      <div className="hd-entry-head">
        <CupLink to="/cup" className="hd-back">‹ Scoreboard</CupLink>
        <CupLink to={`/cup/team/${other}`} className="hd-tv-link">{TEAM_NAMES[other]} ›</CupLink>
      </div>
      <header className={`hd-team-head ${team}`} style={vtName(`team-${team}`)}>
        <Logo name={team} className="hd-team-head-logo" />
        <div className="hd-team-head-text">
          <h1>{TEAM_NAMES[team]}</h1>
          <span>
            {standing.clinched ? (standing.clinched === team ? 'Derby winners' : 'Derby runners-up') : `${fmtPoints(standing.needed[team])} to win`}
          </span>
        </div>
        <span className="hd-team-head-pts">{fmtPoints(standing.points[team])}</span>
      </header>

      <ul className="hd-roster">
        {roster.map(p => {
          const a = accolades(p.merit, firsts);
          const top = a.finishes[0] ?? a.qualifiers[0];
          return (
            <li key={p.id}>
              <CupLink to={`/cup/player/${p.id}`} className={`hd-roster-row ${team}`}>
                <Portrait player={p} team={team} photo={photos.get(p.id)} className="hd-roster-portrait" style={vtName(`player-${p.id}`)} />
                <span className="hd-roster-name">
                  <span className="hd-roster-full">{p.first} <b>{p.last}</b></span>
                  {top && <span className="hd-roster-best">{top.label} · {top.event}</span>}
                </span>
                {p.captain && <span className="hd-captain">Captain</span>}
                <span className="hd-roster-go" aria-hidden>›</span>
              </CupLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
