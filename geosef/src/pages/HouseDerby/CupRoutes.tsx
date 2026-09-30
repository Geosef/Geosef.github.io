import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Board from './Board';
import MatchDetail from './MatchDetail';
import PlayerPage from './PlayerPage';
import TeamPage from './TeamPage';

/**
 * The viewer pages of /cup, loaded as one bundle: moving between them never
 * waits on a download, so view transitions can morph straight into the next
 * page. (The marshal page loads separately.)
 */
export default function CupRoutes() {
  return (
    <Routes>
      <Route index element={<Board />} />
      <Route path="match/:matchId" element={<MatchDetail />} />
      <Route path="team/:team" element={<TeamPage />} />
      <Route path="player/:playerId" element={<PlayerPage />} />
    </Routes>
  );
}
