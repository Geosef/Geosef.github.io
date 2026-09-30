import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { FORMAT_NAMES, TEAM_NAMES, matchName, sideName, useMatch, usePlayers, useSessions } from './data';
import { saveHole, setConcession } from './writes';
import {
  TEAMS, holeOutcome, matchStates, segments, strokesOn,
  type HoleOutcome, type MatchState, type TeamId,
} from './scoring';

function finalText(state: MatchState): string {
  if (!state.winner) return 'Halved';
  return `${TEAM_NAMES[state.winner]} won${state.concededBy ? ' (conceded)' : ` ${state.label}`}`;
}

export default function MatchEntry({ user }: { user: User }) {
  const { matchId = '' } = useParams();
  const { match, error } = useMatch(matchId);
  const { byId } = usePlayers();
  const { sessions } = useSessions();
  const [selected, setSelected] = useState<number | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [confirmConcede, setConfirmConcede] = useState<TeamId | null>(null);
  // A finished match locks so a stray tap can't change it; "Correct a score"
  // unlocks it until the marshal taps Done.
  const [correcting, setCorrecting] = useState(false);

  if (error) return <p className="hd-error">{error}</p>;
  if (match === undefined) return <p className="hd-muted">Loading…</p>;
  if (match === null) return <p className="hd-error">No match “{matchId}”. <Link to="/cup/admin">Back</Link></p>;

  const email = user.email ?? '';
  const states = matchStates(match);
  const segs = segments(match);
  const order = segs.flat();
  const afterClose = states.flatMap(s => s.afterClose);
  // Default to the first hole in play order that isn't fully decided yet.
  const hole = selected ?? order.find(h => !holeOutcome(match, h)) ?? order[order.length - 1];
  const outcome = holeOutcome(match, hole);
  const session = sessions?.find(s => s.id === match.session);
  const complete = states.every(s => s.phase === 'final');
  const locked = complete && !correcting;

  const report = (p: Promise<unknown>) => p.catch(e => setWriteError(
    e?.code === 'permission-denied' ? `${email} isn't on the marshal list.` : `Save failed: ${e?.message ?? e}`,
  ));

  // Tapping the current result again clears the hole. Recording a result on
  // an empty hole moves on to the next one; correcting a hole stays put.
  function record(result: HoleOutcome) {
    const next = outcome === result ? null : result;
    report(saveHole(match!.id, email, hole, match!.holes[hole], { result: next }));
    if (!outcome && next) {
      const i = order.indexOf(hole);
      if (i < order.length - 1) setSelected(order[i + 1]);
    }
  }

  return (
    <div className="hd-entry">
      <div className="hd-entry-head">
        <Link to="/cup/admin" className="hd-back">‹ Matches</Link>
        <span className={`hd-sync ${match.pending ? 'pending' : ''}`}>
          {match.pending ? 'Unsynced — will send when online' : 'Saved'}
        </span>
      </div>

      <div className="hd-entry-title">
        <div className="hd-muted">
          {session?.name ?? match.session} · {matchName(match)}
          {session && ` · ${FORMAT_NAMES[session.format] ?? session.format}`}
        </div>
        {states.map((state, i) => (
          <div key={i} className={`hd-status ${state.leader ?? 'even'}`}>
            {state.leader && state.phase !== 'not-started' ? `${TEAM_NAMES[state.leader]} ` : ''}{state.label}
          </div>
        ))}
      </div>

      {writeError && (
        <div className="hd-toast" role="alert">
          {writeError} <button onClick={() => setWriteError(null)}>Dismiss</button>
        </div>
      )}

      {segs.map((seg, i) => (
        <div key={i} className="hd-holes" role="tablist" aria-label="Holes">
          {seg.map(h => {
            const o = holeOutcome(match, h);
            return (
              <button
                key={h}
                role="tab"
                aria-selected={h === hole}
                className={`hd-hole-chip ${o ?? ''} ${h === hole ? 'selected' : ''} ${afterClose.includes(h) ? 'after-close' : ''}`}
                onClick={() => setSelected(h)}
              >
                {h}
              </button>
            );
          })}
        </div>
      ))}

      {locked ? (
        <div className="hd-final">
          <div className="hd-final-tag">Final</div>
          {states.map((state, i) => (
            <div key={i} className={`hd-final-line ${state.winner ?? 'even'}`}>
              {finalText(state)}
            </div>
          ))}
          <Link to="/cup/admin" className="hd-primary hd-final-back">Back to matches</Link>
          <button className="hd-link" onClick={() => setCorrecting(true)}>Correct a score</button>
        </div>
      ) : (
      <>
      {correcting && (
        <div className="hd-correcting">
          <span>Correcting a finished match.</span>
          <button className="hd-primary" onClick={() => setCorrecting(false)}>Done</button>
        </div>
      )}

      <h2 className="hd-hole-title">Hole {hole}</h2>
      {afterClose.includes(hole) && (
        <p className="hd-warn">This nine was already decided — this hole doesn't count.</p>
      )}

      <div className="hd-result">
        {TEAMS.map((team, i) => {
          const strokes = strokesOn(match, team, hole);
          const button = (
            <button
              key={team}
              className={`hd-win ${team} ${outcome === team ? 'selected' : ''}`}
              aria-pressed={outcome === team}
              onClick={() => record(team)}
            >
              <span className="hd-win-team">{TEAM_NAMES[team]} won</span>
              <span className="hd-win-players">{sideName(match, team, byId)}</span>
              {strokes > 0 && (
                <span className="hd-strokes">
                  {'●'.repeat(strokes)} {strokes === 1 ? 'gets a stroke' : `gets ${strokes} strokes`}
                </span>
              )}
            </button>
          );
          return i === 0 ? (
            <React.Fragment key={team}>
              {button}
              <button
                className={`hd-halve ${outcome === 'halved' ? 'selected' : ''}`}
                aria-pressed={outcome === 'halved'}
                onClick={() => record('halved')}
              >
                Halved
              </button>
            </React.Fragment>
          ) : button;
        })}
      </div>
      <p className="hd-muted hd-hint">Tap the selected result again to clear the hole.</p>

      <div className="hd-concede">
        {match.concededBy ? (
          <>
            <span>{TEAM_NAMES[match.concededBy]} conceded the match.</span>
            <button className="hd-link" onClick={() => report(setConcession(match.id, email, null))}>Undo</button>
          </>
        ) : confirmConcede ? (
          <>
            <span>Concede the whole match for {TEAM_NAMES[confirmConcede]}?</span>
            <button className="danger" onClick={() => { report(setConcession(match.id, email, confirmConcede)); setConfirmConcede(null); }}>
              Yes, concede
            </button>
            <button className="hd-link" onClick={() => setConfirmConcede(null)}>Cancel</button>
          </>
        ) : (
          TEAMS.map(t => (
            <button key={t} className="hd-link" onClick={() => setConfirmConcede(t)}>
              {TEAM_NAMES[t]} concedes match
            </button>
          ))
        )}
      </div>
      </>
      )}
    </div>
  );
}
