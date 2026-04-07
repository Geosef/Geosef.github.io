import React, { useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigationType } from 'react-router-dom';
import { NavRightProvider, useNavRight } from './NavRightContext';
import './GolfLeaderboard.css';

// Module-level so scroll positions survive re-renders
const scrollPositions = new Map<string, number>();

function ScrollManager() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const prevPathname = useRef(pathname);

  // Continuously save scroll position for the current path
  useEffect(() => {
    const save = () => { scrollPositions.set(prevPathname.current, window.scrollY); };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, []);

  useEffect(() => {
    if (navType === 'POP') {
      const saved = scrollPositions.get(pathname) ?? 0;
      requestAnimationFrame(() => window.scrollTo(0, saved));
    } else {
      window.scrollTo(0, 0);
    }
    prevPathname.current = pathname;
  }, [pathname, navType]);

  return null;
}

function GolfLayoutInner() {
  const { navRight } = useNavRight();
  return (
    <div className="gl-layout">
      <ScrollManager />
      <header className="gl-subnav">
        <nav className="gl-subnav-links">
          <NavLink
            to="/golf-leaderboard"
            end
            className={({ isActive }) => `gl-subnav-link${isActive ? ' gl-subnav-active' : ''}`}
          >
            Leader Board
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
        </nav>
        <div className="gl-subnav-title">GGC League</div>
        <div className="gl-subnav-right">{navRight}</div>
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

export default function GolfLayout() {
  return (
    <NavRightProvider>
      <GolfLayoutInner />
    </NavRightProvider>
  );
}
