import React, { useEffect, useState } from 'react';
import { Route, Routes, useSearchParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import Board from './Board';
import MatchDetail from './MatchDetail';
import PlayerPage from './PlayerPage';
import RacePage from './RacePage';
import CoursePage from './CoursePage';
import TeamPage from './TeamPage';
import Countdown from './Countdown';
import CupSplash from './CupSplash';
import { auth } from './firebase';
import { useSessions } from './data';
import { useLive } from './staff';

/**
 * The viewer pages of /cup, loaded as one bundle: moving between them never
 * waits on a download, so view transitions can morph straight into the next
 * page. (The staff pages load separately.)
 */
export default function CupRoutes() {
  const gate = usePublicGate();
  if (gate === 'loading') return <CupSplash />;
  if (gate.countdown) return <Countdown sessions={gate.sessions} firstTee={gate.firstTee} />;
  return (
    <>
      <Routes>
        <Route index element={<Board />} />
        <Route path="match/:matchId" element={<MatchDetail />} />
        <Route path="team/:team" element={<TeamPage />} />
        <Route path="player/:playerId" element={<PlayerPage />} />
        <Route path="race" element={<RacePage />} />
        <Route path="course/:courseId" element={<CoursePage />} />
      </Routes>
      {gate.preview && <PreviewBadge />}
    </>
  );
}

const PREVIEW_KEY = 'hd-preview';

/**
 * Before the event the public gets a countdown, until an admin goes live or
 * the first tee time passes (so a forgotten switch never hides live play).
 * Staff see the board early: anyone signed in on this device, or a
 * `?preview` link (remembered; `?preview=off` forgets it). The data is
 * public either way; this only decides what a visitor lands on.
 */
function usePublicGate() {
  const live = useLive();
  const { sessions } = useSessions();
  const [params] = useSearchParams();
  // undefined until auth restores, so signed-in staff don't flash the countdown.
  const [signedIn, setSignedIn] = useState<boolean | undefined>();
  useEffect(() => onAuthStateChanged(auth, u => setSignedIn(!!u)), []);

  const flag = params.get('preview');
  useEffect(() => {
    try {
      if (flag === 'off') localStorage.removeItem(PREVIEW_KEY);
      else if (flag !== null) localStorage.setItem(PREVIEW_KEY, '1');
    } catch { /* not remembered */ }
  }, [flag]);
  const preview = (flag !== null && flag !== 'off') || !!signedIn || remembered();

  const firstTee = sessions?.map(s => s.startsAt).filter((t): t is string => !!t).sort()[0];
  const started = useReached(firstTee);

  // No stages yet means nothing from the server (offline, nothing cached):
  // keep the crest up rather than render a board with no stages.
  if (live === undefined || !sessions?.length || signedIn === undefined) return 'loading' as const;
  const open = live || started || !firstTee;
  return { countdown: !open && !preview, preview: !open && preview, sessions, firstTee: firstTee ?? '' };
}

function remembered(): boolean {
  try { return localStorage.getItem(PREVIEW_KEY) === '1'; } catch { return false; }
}

/** Flips true when `iso` passes, without a reload (for unattended TVs). */
function useReached(iso: string | undefined): boolean {
  const at = iso ? Date.parse(iso) : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!(at > now)) return;
    // Timers clamp past ~24.8 days, so wake at least daily.
    const t = setTimeout(() => setNow(Date.now()), Math.min(at - now + 50, 86_400_000));
    return () => clearTimeout(t);
  }, [at, now]);
  return at <= now;
}

function PreviewBadge() {
  const [params] = useSearchParams();
  // Never on a full-screen board: it'd end up in a stream capture.
  if (params.has('tv')) return null;
  return <div className="hd-preview-badge" role="status">Preview · the public sees the countdown</div>;
}
