import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import TravelCoordinator from './pages/TravelCoordinator/TravelCoordinator';
import GolfLayout from './pages/GolfLeaderboard/GolfLayout';
import GolfLeaderboard from './pages/GolfLeaderboard/GolfLeaderboard';
import PlayerDetail from './pages/GolfLeaderboard/PlayerDetail';
import CourseDetail from './pages/GolfLeaderboard/CourseDetail';
import PlayersList from './pages/GolfLeaderboard/PlayersList';
import CoursesList from './pages/GolfLeaderboard/CoursesList';
import PlayingHandicap from './pages/GolfLeaderboard/PlayingHandicap';
import Playoffs from './pages/GolfLeaderboard/Playoffs';
import RecentScores from './pages/GolfLeaderboard/RecentScores';
import EventDetail from './pages/GolfLeaderboard/EventDetail';
import NotFound from './pages/GolfLeaderboard/NotFound';
import './App.css';


/**
 * The House Derby moved to its own site (ggcderby.com, repo Geosef/ggcderby).
 * 404.html and index.html already redirect /cup links before the app loads;
 * this catches any that get this far.
 */
function CupRedirect() {
  useEffect(() => {
    const l = window.location;
    l.replace(`https://ggcderby.com${l.pathname.replace(/^\/cup/, '') || '/'}${l.search}${l.hash}`);
  }, []);
  return null;
}

function App() {
  return (
    <AuthProvider>
    <Router>
      <div className="App">
        <Routes>
          <Route path="/cup/*" element={<CupRedirect />} />
          <Route path="/travel-coordinator" element={<TravelCoordinator />} />
          <Route path="/golf-leaderboard" element={<GolfLayout />}>
            <Route index element={<GolfLeaderboard />} />
            <Route path="player/:playerName" element={<PlayerDetail />} />
            <Route path="course/:courseName" element={<CourseDetail />} />
            <Route path="event/:eventId" element={<EventDetail />} />
            <Route path="scores" element={<RecentScores />} />
            <Route path="players" element={<PlayersList />} />
            <Route path="courses" element={<CoursesList />} />
            <Route path="handicaps" element={<PlayingHandicap />} />
            <Route path="playoffs" element={<Playoffs />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </div>
    </Router>
    </AuthProvider>
  );
}

export default App;
