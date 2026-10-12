import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { TEAM_NAMES } from './data';
import { removeRole, roleLabel, saveRole, useStaffList, type Role } from './staff';

/** What each role can do, mirroring firestore.rules. */
const ROLES: Array<[string, string]> = [
  ['Marshal', 'Enter and correct scores.'],
  ['Team manager', 'Enter scores. Set, lock and unlock their team’s lineup; sees the other team’s once both have locked.'],
  ['Admin', 'Enter scores. Announce and reopen lineups, and flip the board live.'],
  ['Super admin', 'Everything an admin can do, plus this page.'],
];

/** Add, edit and remove staff (super admins only). Changes apply at once. */
export default function StaffPage({ user }: { user: User }) {
  const me = user.email?.toLowerCase() ?? '';
  const { staff, error } = useStaffList();
  const [editing, setEditing] = useState<string | null>(null);
  const [writeError, setWriteError] = useState('');
  const report = (p: Promise<unknown>) => p.then(() => { setWriteError(''); setEditing(null); }, e => setWriteError(String(e?.message ?? e)));

  return (
    <div className="hd-staff">
      <div className="hd-entry-head">
        <Link to="/cup/admin" className="hd-back">‹ Staff home</Link>
      </div>
      <h1 className="hd-lineup-title">Staff &amp; permissions</h1>
      <p className="hd-muted">
        Everyone signs in with Google using the email listed here. Changes apply right away.
      </p>
      <dl className="hd-role-key">
        {ROLES.map(([name, what]) => <React.Fragment key={name}><dt>{name}</dt><dd>{what}</dd></React.Fragment>)}
      </dl>

      {writeError && <div className="hd-toast" role="alert">{writeError} <button onClick={() => setWriteError('')}>Dismiss</button></div>}

      <section className="hd-panel">
        <div className="hd-panel-title">Add someone</div>
        <RoleForm key={staff?.length} initial={{}} submit="Add" onSave={(email, role) => report(saveRole(email, role, me))} />
      </section>

      {error && <p className="hd-error">{error}</p>}
      {!staff ? <p className="hd-muted">Loading…</p> : staff.map(s => (
        <div key={s.email} className="hd-staff-row">
          {editing === s.email ? (
            <RoleForm
              email={s.email} initial={s} self={s.email === me} submit="Save"
              onSave={(_, role) => report(saveRole(s.email, role, me))}
              onCancel={() => setEditing(null)}
              onRemove={s.email === me ? undefined : () => report(removeRole(s.email))}
            />
          ) : (
            <>
              <div className="hd-staff-who">
                <span className="hd-staff-email">{s.email}{s.email === me && <span className="hd-muted"> (you)</span>}</span>
                <span className="hd-muted">{roleLabel(s)}</span>
              </div>
              <button className="hd-link" onClick={() => setEditing(s.email)}>Edit</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function RoleForm({ email: fixed, initial, self = false, submit, onSave, onCancel, onRemove }: {
  /** Set when editing someone; the email itself can't change. */
  email?: string;
  initial: Role;
  /** Your own row: you can't drop your super admin, so the list always has one. */
  self?: boolean;
  submit: string;
  onSave: (email: string, role: Role) => void;
  onCancel?: () => void;
  onRemove?: () => void;
}) {
  const [email, setEmail] = useState(fixed ?? '');
  const [role, setRole] = useState<Role>(initial);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const flag = (key: 'superAdmin' | 'admin' | 'marshal', label: string, disabled = false) => (
    <label className="hd-check">
      <input type="checkbox" checked={!!role[key]} disabled={disabled} onChange={e => setRole(r => ({ ...r, [key]: e.target.checked }))} />
      {label}
    </label>
  );
  const valid = /.+@.+\..+/.test(email.trim());

  return (
    <form className="hd-role-form" onSubmit={e => { e.preventDefault(); if (valid) onSave(email, role); }}>
      {fixed ? <div className="hd-staff-email">{fixed}</div> : (
        <input
          type="email" className="hd-input" placeholder="name@gmail.com" value={email} autoCapitalize="none" autoCorrect="off"
          onChange={e => setEmail(e.target.value)}
        />
      )}
      <div className="hd-checks">
        {flag('marshal', 'Marshal')}
        {flag('admin', 'Admin')}
        {flag('superAdmin', 'Super admin', self)}
      </div>
      <label className="hd-team-pick">
        Manages
        <select value={role.team ?? ''} onChange={e => setRole(r => ({ ...r, team: (e.target.value || undefined) as Role['team'] }))}>
          <option value="">No team</option>
          <option value="og">{TEAM_NAMES.og}</option>
          <option value="south">{TEAM_NAMES.south}</option>
        </select>
      </label>
      <div className="hd-form-actions">
        <button type="submit" className="hd-primary" disabled={!valid}>{submit}</button>
        {onCancel && <button type="button" className="hd-link" onClick={onCancel}>Cancel</button>}
        {onRemove && (confirmRemove
          ? <button type="button" className="hd-link hd-danger-link" onClick={onRemove}>Yes, remove all access</button>
          : <button type="button" className="hd-link hd-danger-link" onClick={() => setConfirmRemove(true)}>Remove…</button>)}
      </div>
    </form>
  );
}
