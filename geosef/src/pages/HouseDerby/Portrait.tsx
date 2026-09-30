import React from 'react';
import type { Player } from './data';
import type { TeamId } from './scoring';

/** A player's portrait: their photo when one's been uploaded, else initials on the team color. */
export default function Portrait({ player, team, photo, className = '' }: {
  player?: Player; team: TeamId; photo?: string; className?: string;
}) {
  const initials = player ? `${player.first[0] ?? ''}${player.last[0] ?? ''}` : '?';
  return (
    <span className={`hd-portrait ${team} ${className}`}>
      {photo ? <img src={photo} alt="" /> : initials}
    </span>
  );
}
