import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import TravelCoordinator from './pages/TravelCoordinator/TravelCoordinator';
import GolfLeaderboard from './pages/GolfLeaderboard/GolfLeaderboard';
import PlayerDetail from './pages/GolfLeaderboard/PlayerDetail';
import CourseDetail from './pages/GolfLeaderboard/CourseDetail';
import PlayersList from './pages/GolfLeaderboard/PlayersList';
import CoursesList from './pages/GolfLeaderboard/CoursesList';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <span className="App-byline">
            Built by <Link to="/" className="App-byline-link">Joe Carroll</Link>
          </span>
        </header>

        <Routes>
          <Route path="/" element={<Navigate to="/golf-leaderboard" replace />} />
          <Route path="/travel-coordinator" element={<TravelCoordinator />} />
          <Route path="/golf-leaderboard" element={<GolfLeaderboard />} />
          <Route path="/golf-leaderboard/player/:playerName" element={<PlayerDetail />} />
          <Route path="/golf-leaderboard/course/:courseName" element={<CourseDetail />} />
          <Route path="/golf-leaderboard/players" element={<PlayersList />} />
          <Route path="/golf-leaderboard/courses" element={<CoursesList />} />
        </Routes>

        <footer className="App-footer">
          <a
            href="https://docs.google.com/document/d/1hg-nl49_QdqyBlWsAYHjgmQYnvClTUHDigqLMRerrsI"
            target="_blank"
            rel="noopener noreferrer"
            className="App-footer-link"
          >
            League Rules
          </a>
        </footer>
      </div>
    </Router>
  );
}

export default App;
