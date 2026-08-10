import { Trophy } from 'lucide-react';
import { GOLF_EVENTS, PLAYOFF_CHAMPIONS } from '../pages/GolfLeaderboard/eventsData';
import './PlayerFlair.css';

/**
 * Honours shown beside a player's name across the app: the Captain's shield
 * for club captains, a gold trophy for league playoff champions. A player can
 * hold both, in which case the shield comes first.
 *
 * Matching is by exact name, so the rosters in eventsData have to use the same
 * spelling as the scoring sheet — a mismatch shows no flair rather than the
 * wrong one.
 */
const CAPTAINS = new Set(GOLF_EVENTS['captains-cup'].captains ?? []);
const CHAMPIONS = new Set(PLAYOFF_CHAMPIONS.map(w => w.champion));

export function playerHonours(name: string): { captain: boolean; champion: boolean } {
  return { captain: CAPTAINS.has(name), champion: CHAMPIONS.has(name) };
}

export default function PlayerFlair({ name }: { name: string }) {
  const { captain, champion } = playerHonours(name);
  if (!captain && !champion) return null;

  const label = [captain && 'Club Captain', champion && 'Playoff Champion']
    .filter(Boolean)
    .join(', ');

  return (
    <span className="pf" role="img" aria-label={label} title={label}>
      {captain && <img src="/golf/ggc-captains-logo.png" alt="" className="pf-shield" />}
      {champion && <Trophy className="pf-trophy" fill="currentColor" aria-hidden="true" />}
    </span>
  );
}
