import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import TravelCoordinator from './pages/TravelCoordinator/TravelCoordinator';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Joe Carroll</h1>
          <nav className="nav-bar">
            <Link to="/travel-coordinator" className="nav-link">Travel Coordinator</Link>
          </nav>
        </header>
        
        <Routes>
          <Route path="/travel-coordinator" element={<TravelCoordinator />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
