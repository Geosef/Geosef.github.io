import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { TEAM_NAMES, matchSort, teeDay, useMatches, usePlayers, useSessions, type Match, type Player, type Session } from './data';
import {
  announcement, groupSessions, groupSlots, lineupProblems, perSide, picked,
  type GroupSlot, type Slots,
} from './lineups';
import { announce, bothLocked, isAdmin, reopen, saveSlot, setLocked, useGroups, useLineup, type Role } from './staff';
import { TEAMS, matchStates, type TeamId } from './scoring';

const other = (t: TeamId): TeamId => (t === 'og' ? 'south' : 'og');

/**
 * One announcement's lineups. A manager orders their team into slots,
 * blind, then locks. Once both teams have locked, everyone on staff sees the
 * matchups and an admin announces them onto the board.
 */
export default function LineupPage({ user, role }: { user: User; role: Role }) {
  const { group = '' } = useParams();
  const email = user.email ?? '';
  const { sessions } = useSessions();
  const { matches } = useMatches();
  const { players, byId } = usePlayers();
  const groups = useGroups();
  const g = groups?.get(group);
  const both = bothLocked(g);
  const og = useLineup(group, 'og', role.team === 'og' || (both && !!(isAdmin(role) || role.team)));
  const south = useLineup(group, 'south', role.team === 'south' || (both && !!(isAdmin(role) || role.team)));
  const [error, setError] = useState('');

  if (!sessions || !matches || !players || !groups) return <p className="hd-muted">Loading…</p>;
  const stages = groupSessions(sessions, group);
  if (!stages.length) return <p className="hd-error">No lineup “{group}”. <Link to="/cup/admin">Back</Link></p>;

  const layout = groupSlots(sessions, group);
  const lineups = { og, south };
  const team = role.team;
  const mine = team ? lineups[team] : undefined;
  const editable = !!team && !g?.locked[team] && !g?.announced;
  const report = (p: Promise<unknown>) => p.then(() => setError(''), e => setError(
    e?.code === 'permission-denied' ? 'Not allowed: this lineup is locked, or you’re not a manager of this team.' : String(e?.message ?? e),
  ));

  return (
    <div className="hd-lineup">
      <div className="hd-entry-head">
        <Link to="/cup/admin" className="hd-back">‹ Staff home</Link>
        {mine?.loaded && (
          <span className={`hd-sync ${mine.pending ? 'pending' : ''}`}>{mine.pending ? 'Unsynced — will send when online' : 'Saved'}</span>
        )}
      </div>
      <h1 className="hd-lineup-title">{stages.map(s => s.name).join(' + ')}</h1>
      <p className="hd-muted">
        {stages[0].announceAt && `Announcement: ${teeDay(stages[0].announceAt)}. `}
        Slot 1 plays slot 1, and so on. Neither team sees the other’s lineup until both have locked.
      </p>

      <div className="hd-lineup-status">
        {TEAMS.map(t => (
          <span key={t} className={`hd-chip ${t} ${g?.locked[t] ? 'done' : ''}`}>
            {TEAM_NAMES[t]}: {g?.locked[t] ? 'locked' : 'drafting'}
          </span>
        ))}
        {g?.announced && <span className="hd-chip done">On the board</span>}
      </div>

      {error && (
        <div className="hd-toast" role="alert">{error} <button onClick={() => setError('')}>Dismiss</button></div>
      )}

      {both ? (
        <Matchups layout={layout} lineups={{ og: og.slots, south: south.slots }} byId={byId} />
      ) : team && mine ? (
        mine.error ? <p className="hd-error">{mine.error}</p>
          : !mine.loaded ? <p className="hd-muted">Loading…</p>
          : <Editor
              layout={layout} team={team} slots={mine.slots ?? {}} editable={editable}
              roster={players.filter(p => p.team === team).sort(byName)}
              onPick={(n, ids) => report(saveSlot(group, team, n, ids, email))}
            />
      ) : (
        <p className="hd-panel-note hd-muted">Waiting for both teams to lock. Lineups stay hidden until then, from admins too.</p>
      )}

      {team && !g?.announced && mine?.loaded && (
        <LockControls
          team={team} locked={!!g?.locked[team]} otherLocked={!!g?.locked[other(team)]}
          problems={lineupProblems(mine.slots, layout)} pending={mine.pending}
          onLock={v => report(setLocked(group, team, v))}
        />
      )}

      {isAdmin(role) && (
        <AdminControls
          group={group} email={email} layout={layout} both={both} announced={!!g?.announced}
          locked={!!(g?.locked.og || g?.locked.south)}
          matches={matches.filter(m => stages.some(s => s.id === m.session)).sort(matchSort(sessions))}
          lineups={{ og: og.slots, south: south.slots }} loaded={og.fresh && south.fresh}
          onError={setError}
        />
      )}
    </div>
  );
}

/** Captains first, then by last name. */
const byName = (a: Player, b: Player) => Number(b.captain) - Number(a.captain) || a.last.localeCompare(b.last) || a.first.localeCompare(b.first);

const fullName = (p: Player | undefined, id: string) => (p ? `${p.first} ${p.last}` : id);

/** Stage header shown above a stage's first slot: "Alt-Shot 1 · 5:00 PM". */
function StageHead({ session }: { session: Session }) {
  return (
    <h2 className="hd-session-title">
      {session.name}{session.startsAt && <span className="hd-muted"> · {teeDay(session.startsAt)}</span>}
    </h2>
  );
}

function Editor({ layout, team, slots, editable, roster, onPick }: {
  layout: GroupSlot[]; team: TeamId; slots: Slots; editable: boolean; roster: Player[];
  onPick: (n: number, ids: string[]) => void;
}) {
  // Which slot each player is in, so a select can show who's already used.
  const usedIn = new Map<string, number>();
  for (const s of layout) for (const id of picked(slots, s.n)) if (!usedIn.has(id)) usedIn.set(id, s.n);
  const unused = roster.filter(p => !usedIn.has(p.id));

  return (
    <div className={`hd-editor ${team}`}>
      {layout.map((s, i) => {
        const seats = Array.from({ length: perSide(s.session) }, (_, k) => slots[s.n]?.[k] ?? '');
        return (
          <React.Fragment key={s.n}>
            {s.session !== layout[i - 1]?.session && <StageHead session={s.session} />}
            <div className="hd-slot">
              <span className="hd-match-slot">{s.n}</span>
              <div className="hd-slot-seats">
                {seats.map((id, k) => (
                  <select
                    key={k} value={id} disabled={!editable} aria-label={`Slot ${s.n}, player ${k + 1}`}
                    onChange={e => onPick(s.n, seats.map((x, j) => (j === k ? e.target.value : x)))}
                  >
                    <option value="">Pick a player…</option>
                    {roster.map(p => {
                      const at = usedIn.get(p.id);
                      const elsewhere = at !== undefined && p.id !== id;
                      return (
                        <option key={p.id} value={p.id} disabled={elsewhere}>
                          {p.first} {p.last}{p.captain ? ' (C)' : ''}{elsewhere ? ` · slot ${at}` : ''}
                        </option>
                      );
                    })}
                  </select>
                ))}
              </div>
            </div>
          </React.Fragment>
        );
      })}
      {unused.length > 0 && (
        <p className="hd-muted hd-unused">Not in this lineup: {unused.map(p => p.last).join(', ')}</p>
      )}
    </div>
  );
}

function LockControls({ team, locked, otherLocked, problems, pending, onLock }: {
  team: TeamId; locked: boolean; otherLocked: boolean; problems: string[]; pending: boolean;
  onLock: (locked: boolean) => void;
}) {
  if (locked) {
    return (
      <div className="hd-panel">
        <div className="hd-panel-title">Locked</div>
        {otherLocked
          ? <p className="hd-muted">Both teams are locked. Only an admin can reopen the lineups now.</p>
          : (
            <>
              <p className="hd-muted">{TEAM_NAMES[other(team)]} can’t see it. You can unlock until they lock too.</p>
              <button className="hd-secondary" onClick={() => onLock(false)}>Unlock to edit</button>
            </>
          )}
      </div>
    );
  }
  return (
    <div className="hd-panel">
      {problems.length > 0 && (
        <ul className="hd-problems">{problems.map(p => <li key={p}>{p}</li>)}</ul>
      )}
      <button className="hd-primary" disabled={problems.length > 0 || pending} onClick={() => onLock(true)}>
        Lock {TEAM_NAMES[team]} lineup
      </button>
      <p className="hd-muted">
        {pending ? 'Waiting for your picks to sync.' : 'Lock when it’s final. Once both teams lock, the matchups are revealed to both.'}
      </p>
    </div>
  );
}

/** Both lineups side by side, slot against slot. */
function Matchups({ layout, lineups, byId }: {
  layout: GroupSlot[]; lineups: Record<TeamId, Slots | undefined>; byId: Map<string, Player>;
}) {
  return (
    <div className="hd-matchups">
      {layout.map((s, i) => (
        <React.Fragment key={s.n}>
          {s.session !== layout[i - 1]?.session && <StageHead session={s.session} />}
          <div className="hd-match-row">
            <span className="hd-match-slot">{s.n}</span>
            <span className="hd-match-sides">
              {TEAMS.map(t => {
                const ids = picked(lineups[t], s.n);
                return <span key={t} className={t}>{ids.length ? ids.map(id => fullName(byId.get(id), id)).join(' & ') : '—'}</span>;
              })}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function AdminControls({ group, email, layout, both, announced, locked, matches, lineups, loaded, onError }: {
  group: string; email: string; layout: GroupSlot[]; both: boolean; announced: boolean; locked: boolean;
  matches: Match[]; lineups: Record<TeamId, Slots | undefined>;
  /** Both lineups confirmed by the server, so a stale cached copy is never announced. */
  loaded: boolean;
  onError: (e: string) => void;
}) {
  const [busy, setBusy] = useState<'' | 'announce' | 'reopen'>('');
  const [confirm, setConfirm] = useState<'' | 'announce' | 'reopen'>('');
  const scored = matches.filter(m => matchStates(m).some(s => s.phase !== 'not-started'));
  const problems = TEAMS.flatMap(t => lineupProblems(lineups[t], layout).map(p => `${TEAM_NAMES[t]}: ${p}`));
  const run = (kind: 'announce' | 'reopen', p: () => Promise<unknown>) => {
    setConfirm('');
    setBusy(kind);
    p().then(() => onError(''), e => onError(String(e?.message ?? e))).finally(() => setBusy(''));
  };
  // Players announced on an already-scored match would rewrite who played it.
  const warnScored = scored.length > 0 && <p className="hd-warn">{scored.length} of these matches already have scores.</p>;

  return (
    <section className="hd-panel hd-admin-controls">
      <div className="hd-panel-title">Admin</div>
      {announced ? (
        <p className="hd-muted">These matchups are on the board.</p>
      ) : both ? (
        <>
          {problems.length > 0 && <ul className="hd-problems">{problems.map(p => <li key={p}>{p}</li>)}</ul>}
          {busy === 'announce' ? (
            <p className="hd-muted">Announcing… (waiting for the server)</p>
          ) : confirm === 'announce' ? (
            <>
              {warnScored}
              <p>Put these matchups on the public board?</p>
              <button className="hd-primary" onClick={() => run('announce', () => announce(group, announcement(layout, matches, lineups), email))}>Yes, announce</button>
              <button className="hd-link" onClick={() => setConfirm('')}>Cancel</button>
            </>
          ) : (
            <>
              <button className="hd-primary" disabled={!loaded || problems.length > 0} onClick={() => setConfirm('announce')}>Announce matchups</button>
              {!loaded && <p className="hd-muted">Waiting for a connection to confirm both lineups.</p>}
            </>
          )}
        </>
      ) : (
        <p className="hd-muted">Announce opens once both teams have locked.</p>
      )}

      {(locked || announced) && (
        busy === 'reopen' ? <p className="hd-muted">Reopening…</p>
        : confirm === 'reopen' ? (
          <div className="hd-reopen">
            {warnScored}
            <p>Unlock both teams so they can change their lineups? {announced && 'The board keeps the current matchups until you announce again.'}</p>
            <button className="hd-secondary" onClick={() => run('reopen', () => reopen(group, email))}>Yes, reopen</button>
            <button className="hd-link" onClick={() => setConfirm('')}>Cancel</button>
          </div>
        ) : (
          <button className="hd-link" onClick={() => setConfirm('reopen')}>Reopen lineups…</button>
        )
      )}
    </section>
  );
}
