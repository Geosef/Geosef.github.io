import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import './GolfLeaderboard.css';

export default function GolfLayout() {
  return (
    <div className="gl-layout">
      <header className="gl-subnav">
        <NavLink
          to="/golf-leaderboard"
          end
          className={({ isActive }) => `gl-subnav-link${isActive ? ' gl-subnav-active' : ''}`}
        >
          Leaderboard
        </NavLink>
        <NavLink
          to="/golf-leaderboard/players"
          className={({ isActive }) => `gl-subnav-link${isActive ? ' gl-subnav-active' : ''}`}
        >
          Players
        </NavLink>
        <NavLink
          to="/golf-leaderboard/courses"
          className={({ isActive }) => `gl-subnav-link${isActive ? ' gl-subnav-active' : ''}`}
        >
          Courses
        </NavLink>
      </header>

      <Outlet />

      <footer className="gl-footer">
        <div className="gl-footer-inner">
          <a
            href="https://docs.google.com/document/d/1hg-nl49_QdqyBlWsAYHjgmQYnvClTUHDigqLMRerrsI"
            target="_blank"
            rel="noopener noreferrer"
            className="gl-footer-link"
          >
            League Rules
          </a>
          <span className="gl-footer-credit">
            Built by <a href="/" className="gl-footer-link">Joe Carroll</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
