import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import TravelCoordinator from './pages/TravelCoordinator/TravelCoordinator';
import GolfLayout from './pages/GolfLeaderboard/GolfLayout';
import GolfLeaderboard from './pages/GolfLeaderboard/GolfLeaderboard';
import PlayerDetail from './pages/GolfLeaderboard/PlayerDetail';
import CourseDetail from './pages/GolfLeaderboard/CourseDetail';
import PlayersList from './pages/GolfLeaderboard/PlayersList';
import CoursesList from './pages/GolfLeaderboard/CoursesList';
import RecentScores from './pages/GolfLeaderboard/RecentScores';
import './App.css';

function App() {
  return (
    <AuthProvider>
    <Router>
      <div className="App">
        <Routes>
          <Route path="/travel-coordinator" element={<TravelCoordinator />} />
          <Route path="/golf-leaderboard" element={<GolfLayout />}>
            <Route index element={<GolfLeaderboard />} />
            <Route path="player/:playerName" element={<PlayerDetail />} />
            <Route path="course/:courseName" element={<CourseDetail />} />
            <Route path="scores" element={<RecentScores />} />
            <Route path="players" element={<PlayersList />} />
            <Route path="courses" element={<CoursesList />} />
          </Route>
        </Routes>
      </div>
    </Router>
    </AuthProvider>
  );
}

export default App;
