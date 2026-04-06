import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import TravelCoordinator from './pages/TravelCoordinator/TravelCoordinator';
import GolfLeaderboard from './pages/GolfLeaderboard/GolfLeaderboard';
import PlayerDetail from './pages/GolfLeaderboard/PlayerDetail';
import CourseDetail from './pages/GolfLeaderboard/CourseDetail';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Joe Carroll</h1>
          <nav className="nav-bar">
            <Link to="/travel-coordinator" className="nav-link">Travel Coordinator</Link>
            <Link to="/golf-leaderboard" className="nav-link">Golf Leaderboard</Link>
          </nav>
        </header>

        <Routes>
          <Route path="/travel-coordinator" element={<TravelCoordinator />} />
          <Route path="/golf-leaderboard" element={<GolfLeaderboard />} />
          <Route path="/golf-leaderboard/player/:playerName" element={<PlayerDetail />} />
          <Route path="/golf-leaderboard/course/:courseName" element={<CourseDetail />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
