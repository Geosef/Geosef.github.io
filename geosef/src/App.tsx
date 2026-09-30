import React, { lazy, Suspense } from 'react';
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
import CupSplash from './pages/HouseDerby/CupSplash';
import './App.css';

// Lazy so the Firebase SDK only loads on /cup, not on every page. The crest
// splash covers the download.
const HouseDerbyAdmin = lazy(() => import('./pages/HouseDerby/Admin'));
const HouseDerby = lazy(() => import('./pages/HouseDerby/CupRoutes'));

function App() {
  return (
    <AuthProvider>
    <Router>
      <div className="App">
        <Routes>
          <Route path="/cup/*" element={<Suspense fallback={<CupSplash />}><HouseDerby /></Suspense>} />
          <Route path="/cup/admin/:matchId?" element={<Suspense fallback={<CupSplash />}><HouseDerbyAdmin /></Suspense>} />
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
