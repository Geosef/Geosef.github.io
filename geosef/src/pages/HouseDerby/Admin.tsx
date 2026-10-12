import React, { useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { useStaff, useGroups, useLive, setLive, bothLocked, canScore, isAdmin, roleLabel, type Role } from './staff';
import { FORMAT_NAMES, TEAM_NAMES, activeSessionId, matchSort, sideName, statusLabel, teeDay, useMatches, usePlayers, useSessions } from './data';
import { groupIds, groupSessions } from './lineups';
import { TEAMS, matchStates } from './scoring';
import MatchEntry from './MatchEntry';
import LineupPage from './LineupPage';
import StaffPage from './StaffPage';
import TestingTools from './DemoPanel';
import { useCupChrome } from './brand';
import Logo from './Logo';
import './HouseDerby.css';

export default function Admin() {
  const { user, role, ready, signIn, signOut } = useStaff();
  const [signInError, setSignInError] = useState('');
  useCupChrome('House Derby · Staff');

  if (!ready) return <div className="hd-page"><p className="hd-muted">Loading…</p></div>;

  if (!user) {
    return (
      <div className="hd-page hd-signin">
        <Logo name="crest" className="hd-signin-crest" />
        <h1>House Derby</h1>
        <p className="hd-muted">Score entry and lineups</p>
        <button className="hd-primary" onClick={() => signIn().catch(e => setSignInError(e.message))}>
          Sign in with Google
        </button>
        {signInError && <p className="hd-error">{signInError}</p>}
      </div>
    );
  }

  const r = role ?? {};
  return (
    <div className="hd-page">
      <header className="hd-admin-bar">
        <span>{roleLabel(r)} · {user.email}</span>
        <button className="hd-link" onClick={signOut}>Sign out</button>
      </header>
      <Routes>
        <Route index element={<Home user={user} role={r} />} />
        <Route path="lineup/:group" element={<LineupPage user={user} role={r} />} />
        <Route path="staff" element={r.superAdmin ? <StaffPage user={user} /> : <p className="hd-muted hd-panel-note">Only super admins manage staff.</p>} />
        {/* Keyed so per-match state (selected hole, correcting) resets between matches. */}
        <Route path=":matchId" element={<MatchEntryKeyed user={user} />} />
      </Routes>
    </div>
  );
}

function MatchEntryKeyed({ user }: { user: User }) {
  const { matchId } = useParams();
  return <MatchEntry key={matchId} user={user} />;
}


function Home({ user, role }: { user: User; role: Role }) {
  const email = user.email ?? '';
  const scorer = canScore(role);
  if (!scorer) {
    return <p className="hd-muted hd-panel-note">{email} isn't on the staff list. Ask the committee to add you.</p>;
  }
  return (
    <>
      {role.superAdmin && (
        <Link to="/cup/admin/staff" className="hd-match-row hd-staff-link">
          <span className="hd-match-sides"><span className="hd-group-name">Staff &amp; permissions</span></span>
          <span className="hd-group-next">Manage ›</span>
        </Link>
      )}
      {isAdmin(role) && <LivePanel email={email} />}
      {(isAdmin(role) || role.team) && <GroupList role={role} />}
      {scorer && <MatchList />}
      {role.superAdmin && <TestingTools email={email} />}
    </>
  );
}

/** The public board's on/off switch (it also opens on its own at first tee). */
function LivePanel({ email }: { email: string }) {
  const live = useLive();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (live === undefined) return null;
  const flip = () => {
    setBusy(true);
    setLive(!live, email).then(() => setError(''), e => setError(e.message)).finally(() => setBusy(false));
  };
  return (
    <section className="hd-panel">
      <div className="hd-panel-row">
        <div>
          <div className="hd-panel-title">Public board: {live ? 'Live' : 'Countdown'}</div>
          <div className="hd-muted">
            {live ? 'Everyone sees the scoreboard.' : 'Opens on its own at first tee. '}
            {!live && <Link to="/cup?preview">Preview the board ›</Link>}
          </div>
        </div>
        <button className={live ? 'hd-secondary' : 'hd-primary'} disabled={busy} onClick={flip}>
          {live ? 'Back to countdown' : 'Go live'}
        </button>
      </div>
      {error && <p className="hd-error">{error}</p>}
    </section>
  );
}

/** One row per announcement: who has locked, and whether it's out. */
function GroupList({ role }: { role: Role }) {
  const { sessions } = useSessions();
  const groups = useGroups();
  if (!sessions || !groups) return null;
  return (
    <section>
      <h2 className="hd-session-title">Lineups</h2>
      {groupIds(sessions).map(id => {
        const stages = groupSessions(sessions, id);
        const g = groups.get(id);
        const at = stages[0].announceAt;
        const next = g?.announced ? '' : role.team && !g?.locked[role.team] ? 'Set lineup' : isAdmin(role) && bothLocked(g) ? 'Announce' : '';
        return (
          <Link key={id} to={`/cup/admin/lineup/${id}`} className="hd-match-row hd-group-row">
            <span className="hd-match-sides">
              <span className="hd-group-name">{stages.map(s => s.name).join(' + ')}</span>
              <span className="hd-muted">{at ? `Announce ${teeDay(at)}` : ''}</span>
            </span>
            <span className="hd-group-status">
              {g?.announced
                ? <span className="hd-chip done">Announced</span>
                : TEAMS.map(t => <span key={t} className={`hd-chip ${t} ${g?.locked[t] ? 'done' : ''}`}>{t === 'og' ? 'OG' : 'South'} {g?.locked[t] ? 'locked' : 'drafting'}</span>)}
              {next && <span className="hd-group-next">{next} ›</span>}
            </span>
          </Link>
        );
      })}
    </section>
  );
}

function MatchList() {
  const { sessions, error: sErr } = useSessions();
  const { matches, error: mErr } = useMatches();
  const { byId } = usePlayers();
  const error = sErr ?? mErr;

  if (error) return <p className="hd-error">{error}</p>;
  if (!sessions || !matches) return <p className="hd-muted">Loading…</p>;

  const sorted = [...matches].sort(matchSort(sessions));
  // Stages are played one at a time, so only the current one starts open.
  const active = activeSessionId(sessions, matches);

  return (
    <div className="hd-list">
      <h2 className="hd-session-title">Scores</h2>
      {sessions.map(session => {
        const list = sorted.filter(m => m.session === session.id);
        const finals = list.filter(m => matchStates(m).every(s => s.phase === 'final')).length;
        const started = list.some(m => matchStates(m).some(s => s.phase !== 'not-started'));
        const progress = finals === list.length ? 'Complete' : started ? `${finals}/${list.length} final` : 'Not started';
        return (
        // Keyed on the active stage so manual expand/collapse resets when play moves on.
        <details key={`${session.id}-${active}`} className="hd-stage" open={session.id === active}>
          <summary>
            <span className="hd-session-title">
              {session.day === 'fri' ? 'Fri' : 'Sat'} · {session.name}
              <span className="hd-muted"> · {FORMAT_NAMES[session.format] ?? session.format} · {session.nines ? 'front & back nines' : `${session.holes} holes`}</span>
            </span>
            <span className={`hd-stage-progress ${session.id === active ? 'active' : ''}`}>
              {session.id === active && finals < list.length ? 'Now playing · ' : ''}{progress}
            </span>
          </summary>
          {session.note && <p className="hd-muted hd-session-note">{session.note}</p>}
          {list.map(m => {
            const states = matchStates(m);
            // Color by the nine in play, else the latest one with a result.
            const current = states.find(s => s.phase === 'live')
              ?? [...states].reverse().find(s => s.phase === 'final')
              ?? states[0];
            return (
              <Link key={m.id} to={`/cup/admin/${m.id}`} className="hd-match-row">
                <span className="hd-match-slot">{m.slot}{m.nine ? (m.nine === 'front' ? 'F' : 'B') : ''}</span>
                <span className="hd-match-sides">
                  <span className="og">{sideName(m, 'og', byId)}</span>
                  <span className="south">{sideName(m, 'south', byId)}</span>
                </span>
                <span className={`hd-match-status ${current.leader ?? 'even'}`}>
                  {statusLabel(states)}{m.pending && ' ⟳'}
                </span>
              </Link>
            );
          })}
        </details>
        );
      })}
    </div>
  );
}
