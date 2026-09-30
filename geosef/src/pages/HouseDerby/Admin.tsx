import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMarshal } from './useMarshal';
import { FORMAT_NAMES, matchSort, sideName, statusLabel, useMatches, usePlayers, useSessions } from './data';
import { matchStates } from './scoring';
import MatchEntry from './MatchEntry';
import { LOGOS, useCupChrome } from './brand';
import './HouseDerby.css';

export default function Admin() {
  const { user, ready, signIn, signOut } = useMarshal();
  const { matchId } = useParams();
  const [signInError, setSignInError] = useState('');
  useCupChrome('House Derby · Marshal');

  if (!ready) return <div className="hd-page"><p className="hd-muted">Loading…</p></div>;

  if (!user) {
    return (
      <div className="hd-page hd-signin">
        <img className="hd-signin-crest" src={LOGOS.crest} alt="" />
        <h1>House Derby</h1>
        <p className="hd-muted">Marshal score entry</p>
        <button className="hd-primary" onClick={() => signIn().catch(e => setSignInError(e.message))}>
          Sign in with Google
        </button>
        {signInError && <p className="hd-error">{signInError}</p>}
      </div>
    );
  }

  return (
    <div className="hd-page">
      <header className="hd-admin-bar">
        <span>Marshal · {user.email}</span>
        <button className="hd-link" onClick={signOut}>Sign out</button>
      </header>
      {/* Keyed so per-match state (selected hole, correcting) resets between matches. */}
      {matchId ? <MatchEntry key={matchId} user={user} /> : <MatchList />}
    </div>
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

  return (
    <div className="hd-list">
      {sessions.map(session => (
        <section key={session.id}>
          <h2 className="hd-session-title">
            {session.day === 'fri' ? 'Fri' : 'Sat'} · {session.name}
            <span className="hd-muted"> · {FORMAT_NAMES[session.format] ?? session.format} · {session.holes} holes</span>
          </h2>
          {session.note && <p className="hd-muted hd-session-note">{session.note}</p>}
          {sorted.filter(m => m.session === session.id).map(m => {
            const states = matchStates(m);
            // Color by the nine in play, else the latest one with a result.
            const current = states.find(s => s.phase === 'live')
              ?? [...states].reverse().find(s => s.phase === 'final')
              ?? states[0];
            return (
              <Link key={m.id} to={`/cup/admin/${m.id}`} className="hd-match-row">
                <span className="hd-match-slot">{m.slot}</span>
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
        </section>
      ))}
    </div>
  );
}
