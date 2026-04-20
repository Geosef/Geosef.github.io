import React, { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigationType } from 'react-router-dom';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { NavRightProvider, useNavRight } from './NavRightContext';
import './GolfLeaderboard.css';

const LEAGUE_RULES_URL = 'https://docs.google.com/document/d/1hg-nl49_QdqyBlWsAYHjgmQYnvClTUHDigqLMRerrsI';
const SUBMIT_SCORES_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeChh3is0Cgeh4Hph2msTn4n31s75n3WA3IqU74ti-BxdIumg/viewform';

const NAV_LINKS: { to: string; label: string; end?: boolean }[] = [
  { to: '/golf-leaderboard', label: 'Leader Board', end: true },
  { to: '/golf-leaderboard/scores', label: 'Scores' },
  { to: '/golf-leaderboard/players', label: 'Players' },
  { to: '/golf-leaderboard/courses', label: 'Courses' },
];

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
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Set page title + favicon to golf theme while on /golf-leaderboard routes
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'GGC League';

    // Remove any existing favicon links (including the default /favicon.ico)
    // and install a fresh SVG emoji favicon. Browsers cache aggressively, so
    // swapping href on the existing link often doesn't take effect.
    const prevLinks = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'),
    );
    prevLinks.forEach(l => l.remove());

    const svg =
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⛳</text></svg>";
    const golfLink = document.createElement('link');
    golfLink.rel = 'icon';
    golfLink.type = 'image/svg+xml';
    golfLink.href = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    document.head.appendChild(golfLink);

    return () => {
      document.title = prevTitle;
      golfLink.remove();
      prevLinks.forEach(l => document.head.appendChild(l));
    };
  }, []);

  // Lock body scroll + close on Escape when menu is open
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="gl-layout">
      <ScrollManager />
      <header className="gl-subnav">
        <button
          className="gl-subnav-menu-btn"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={22} />
        </button>
        <div className="gl-subnav-title">GGC League</div>
        <div className="gl-subnav-right">{navRight}</div>
      </header>

      {menuOpen && (
        <div className="gl-menu-backdrop" onClick={() => setMenuOpen(false)}>
          <div
            className="gl-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onClick={e => e.stopPropagation()}
          >
            <div className="gl-menu-header">
              <div className="gl-menu-title">GGC League</div>
              <button
                className="gl-menu-close"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                <X size={22} />
              </button>
            </div>
            <nav className="gl-menu-nav">
              {NAV_LINKS.map(l => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => `gl-menu-link${isActive ? ' gl-menu-link--active' : ''}`}
                >
                  {l.label}
                </NavLink>
              ))}
              <div className="gl-menu-divider" />
              <a
                href={SUBMIT_SCORES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="gl-menu-link gl-menu-link--external"
              >
                <span>Submit Scores</span>
                <ArrowUpRight size={18} />
              </a>
              <a
                href={LEAGUE_RULES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="gl-menu-link gl-menu-link--external"
              >
                <span>League Rules</span>
                <ArrowUpRight size={18} />
              </a>
            </nav>
          </div>
        </div>
      )}

      <Outlet />

      <footer className="gl-footer">
        <div className="gl-footer-inner">
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
