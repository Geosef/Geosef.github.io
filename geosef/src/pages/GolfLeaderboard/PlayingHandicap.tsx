import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, RotateCcw } from 'lucide-react';
import './PlayingHandicap.css';
import type { CourseVariantData, PlayerPlayingHandicaps, PlayingHandicapData } from '../../types/golf';
import { sessionCache, loadAction } from '../../golf-cache';
import { getMyPlayerName } from '../../services/userPrefs';
import { ListError } from './leaderboard-utils';
import { useAuth } from '../../context/AuthContext';

const NINE_HOLE_COURSES = ['Ballwin'];

// Mirrors the backend's "name|tees|frontBack" handicap key.
function variantKey(course: string, tees: string, frontBack: string) {
  return `${course}|${tees}|${frontBack}`;
}

function normalizeName(s: string) {
  return s.replace(/\./g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Best-effort "is this the signed-in user" match. Exact normalized match, else
// same last name with a first-name that's equal or a prefix (so a shortened
// first name finds its longer form). Conservative enough not to false-match
// within one league.
function isSamePerson(playerName: string, userName: string): boolean {
  const pn = normalizeName(playerName);
  const un = normalizeName(userName);
  if (!pn || !un) return false;
  if (pn === un) return true;
  const pParts = pn.split(' ');
  const uParts = un.split(' ');
  const pLast = pParts[pParts.length - 1];
  const uLast = uParts[uParts.length - 1];
  if (!pLast || pLast !== uLast) return false;
  const pFirst = pParts[0];
  const uFirst = uParts[0];
  return pFirst === uFirst || pFirst.startsWith(uFirst) || uFirst.startsWith(pFirst);
}

interface NineOption { key: string; label: string }

function strokesFor(
  player: PlayerPlayingHandicaps,
  course: string,
  tees: string,
  nine: string,
): number | null {
  const hcp = player.handicaps;
  if (nine === '18') {
    const f = hcp[variantKey(course, tees, 'Front')];
    const b = hcp[variantKey(course, tees, 'Back')];
    return f == null || b == null ? null : f + b;
  }
  const v = hcp[variantKey(course, tees, nine)];
  return v == null ? null : v;
}

export default function PlayingHandicap() {
  const { user, token } = useAuth();
  const [phData, setPhData] = useState<PlayingHandicapData | null>(sessionCache.playingHandicaps);
  const [variants, setVariants] = useState<CourseVariantData | null>(sessionCache.courseVariants);
  const [error, setError] = useState(false);
  // The signed-in user's roster name, resolved from their token via the backend.
  const [rosterName, setRosterName] = useState<string | null>(null);

  const [group, setGroup] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [comboOpen, setComboOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  const [course, setCourse] = useState('');
  const [tees, setTees] = useState('');
  const [nine, setNine] = useState('');
  // Only seed the signed-in user once, and don't fight a manual change.
  const [userSeeded, setUserSeeded] = useState(false);

  const load = useCallback(() => {
    setError(false);
    loadAction('playingHandicaps').then(setPhData).catch(() => setError(true));
    loadAction('courseVariants').then(setVariants).catch(() => setError(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Resolve the signed-in user's roster name (email → name via the backend).
  useEffect(() => {
    if (!token) { setRosterName(null); return; }
    let active = true;
    getMyPlayerName(token).then(name => { if (active) setRosterName(name); });
    return () => { active = false; };
  }, [token]);

  const players = useMemo(() => {
    // Dedupe by name as a safety net (the sheet repeats players; the backend
    // already collapses them, but keep the page robust if that ever regresses).
    const seen = new Set<string>();
    const unique = [];
    for (const p of phData?.players ?? []) {
      if (seen.has(p.player)) continue;
      seen.add(p.player);
      unique.push(p);
    }
    return unique.sort((a, b) => a.player.localeCompare(b.player));
  }, [phData]);

  const byName = useMemo(() => {
    const m = new Map<string, PlayerPlayingHandicaps>();
    for (const p of players) m.set(p.player, p);
    return m;
  }, [players]);

  // The handicaps-list player that is the signed-in user. Prefer the roster name
  // (resolved from their email — reliable), falling back to a fuzzy match on the
  // Google display name if the roster lookup hasn't landed or found nothing.
  const meName = useMemo(() => {
    if (!players.length) return null;
    const target = rosterName ?? user?.name ?? null;
    if (!target) return null;
    const norm = normalizeName(target);
    const exact = players.find(p => normalizeName(p.player) === norm);
    if (exact) return exact.player;
    return players.find(p => isSamePerson(p.player, target))?.player ?? null;
  }, [players, rosterName, user]);

  // Seed the group with the signed-in user once we've resolved who they are.
  // userSeeded latches so we don't re-add them after a manual removal.
  useEffect(() => {
    if (userSeeded || !meName) return;
    if (group.length === 0) setGroup([meName]);
    setUserSeeded(true);
  }, [userSeeded, meName, group.length]);

  // Close the combobox on outside click.
  useEffect(() => {
    if (!comboOpen) return;
    const onDown = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setComboOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [comboOpen]);

  const matches = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return players
      .filter(p => !group.includes(p.player))
      .filter(p => {
        if (!tokens.length) return true;
        const name = p.player.toLowerCase();
        return tokens.every(t => name.includes(t));
      });
  }, [players, group, query]);

  function addPlayer(name: string) {
    setGroup(g => (g.includes(name) ? g : [...g, name]));
    setQuery('');
    setComboOpen(false);
  }
  function removePlayer(name: string) {
    setGroup(g => g.filter(n => n !== name));
  }

  // Reset to the just-loaded state: clear the course selection and partners,
  // but keep yourself prefilled (the default).
  function resetForm() {
    setGroup(meName ? [meName] : []);
    setQuery('');
    setComboOpen(false);
    setCourse('');
    setTees('');
    setNine('');
  }

  const isDirty =
    !!course || !!query || group.length > (meName ? 1 : 0) ||
    (group.length === 1 && !!meName && group[0] !== meName);

  // Course names in sheet order.
  const courseNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const v of variants?.courses ?? []) {
      if (!seen.has(v.name)) { seen.add(v.name); names.push(v.name); }
    }
    return names;
  }, [variants]);

  const teesForCourse = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const v of variants?.courses ?? []) {
      if (v.name !== course) continue;
      if (!seen.has(v.tees)) { seen.add(v.tees); list.push(v.tees); }
    }
    return list;
  }, [variants, course]);

  const nineOptions = useMemo<NineOption[]>(() => {
    const fbs = new Set<string>();
    for (const v of variants?.courses ?? []) {
      if (v.name === course && v.tees === tees) fbs.add(v.frontBack);
    }
    const isNine = NINE_HOLE_COURSES.includes(course);
    const opts: NineOption[] = [];
    if (fbs.has('Front')) opts.push({ key: 'Front', label: 'Front 9' });
    if (fbs.has('Back')) opts.push({ key: 'Back', label: 'Back 9' });
    if (fbs.has('Front') && fbs.has('Back')) opts.push({ key: '18', label: '18 holes' });
    if (fbs.has('')) opts.push({ key: '', label: isNine ? '9 holes' : '18 holes' });
    return opts;
  }, [variants, course, tees]);

  // Keep child selections valid as their parent changes.
  useEffect(() => {
    if (course && !teesForCourse.includes(tees)) setTees(teesForCourse[0] ?? '');
  }, [course, teesForCourse, tees]);

  useEffect(() => {
    if (!nineOptions.some(o => o.key === nine)) setNine(nineOptions[0]?.key ?? '');
  }, [nineOptions, nine]);

  // Course meta for the selection (par/rating/slope), summed for 18.
  const courseMeta = useMemo(() => {
    if (!course || !tees || !variants) return null;
    const findVar = (fb: string) =>
      variants.courses.find(v => v.name === course && v.tees === tees && v.frontBack === fb) ?? null;
    if (nine === '18') {
      const f = findVar('Front');
      const b = findVar('Back');
      if (!f || !b) return null;
      return { par: f.par + b.par, rating: Math.round((f.rating + b.rating) * 10) / 10, slope: null as number | null };
    }
    const v = findVar(nine);
    return v ? { par: v.par, rating: v.rating, slope: v.slope as number | null } : null;
  }, [course, tees, nine, variants]);

  // Strokes per group member for the current selection, most strokes first.
  const groupResults = useMemo(() => {
    if (!course || !tees) return [];
    return group
      .map(name => {
        const p = byName.get(name);
        return { name, strokes: p ? strokesFor(p, course, tees, nine) : null };
      })
      .sort((a, b) => {
        if (a.strokes === b.strokes) return a.name.localeCompare(b.name);
        if (a.strokes == null) return 1;
        if (b.strokes == null) return -1;
        return b.strokes - a.strokes;
      });
  }, [group, byName, course, tees, nine]);

  const loading = !phData || !variants;
  const noData = !loading && players.length === 0;

  const metaParts: string[] = [];
  if (courseMeta?.par != null) metaParts.push(`Par ${courseMeta.par}`);
  if (courseMeta?.rating != null) metaParts.push(`Rating ${courseMeta.rating.toFixed(1)}`);
  if (courseMeta?.slope != null) metaParts.push(`Slope ${courseMeta.slope}`);

  const showResult = group.length > 0 && !!course && !!tees;

  return (
    <div className="gl-wrapper">
      <div className="gph-head">
        <div className="gph-head-text">
          <h1 className="gph-title">Playing Handicaps</h1>
          <p className="gph-sub">Strokes your group gets before a round — add players, pick a course and tees.</p>
        </div>
        {!loading && !noData && isDirty && (
          <button type="button" className="gph-reset" onClick={resetForm}>
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>

      <div className="gph">
        {error && loading ? (
          <ListError onRetry={load} />
        ) : loading ? (
          <div className="gl-loading">Loading…</div>
        ) : noData ? (
          <div className="gl-loading">No handicap data available yet.</div>
        ) : (
          <>
            <div className="gph-controls">
              {/* Players */}
              <div className="gph-field">
                <span className="gph-label">Players</span>
                {group.length > 0 && (
                  <ul className="gph-group">
                    {group.map(name => (
                      <li key={name} className="gph-chip">
                        <span>{name}{name === meName && <span className="gph-chip-you"> (you)</span>}</span>
                        <button
                          type="button"
                          className="gph-chip-remove"
                          aria-label={`Remove ${name}`}
                          onClick={() => removePlayer(name)}
                        >
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="gph-combo" ref={comboRef}>
                  <input
                    type="text"
                    className="gl-search-input gph-combo-input"
                    placeholder="Search players to add…"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setComboOpen(true); }}
                    onFocus={() => setComboOpen(true)}
                    role="combobox"
                    aria-expanded={comboOpen}
                    aria-controls="gph-combo-list"
                  />
                  {comboOpen && (
                    <ul className="gph-combo-list" id="gph-combo-list" role="listbox">
                      {matches.length === 0 ? (
                        <li className="gph-combo-empty">No players found</li>
                      ) : (
                        matches.map(p => (
                          <li key={p.player} role="option" aria-selected={false}>
                            <button
                              type="button"
                              className="gph-combo-option"
                              onClick={() => addPlayer(p.player)}
                            >
                              {p.player}
                              {p.player === meName && <span className="gph-chip-you"> (you)</span>}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* Course */}
              <label className="gph-field">
                <span className="gph-label">Course</span>
                <select className="gph-select" value={course} onChange={e => setCourse(e.target.value)}>
                  <option value="">Select course…</option>
                  {courseNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>

              <div className="gph-row">
                <label className="gph-field">
                  <span className="gph-label">Tees</span>
                  <select
                    className="gph-select"
                    value={tees}
                    onChange={e => setTees(e.target.value)}
                    disabled={!course}
                  >
                    {teesForCourse.length === 0 && <option value="">—</option>}
                    {teesForCourse.map(t => (
                      <option key={t} value={t}>{t || '—'}</option>
                    ))}
                  </select>
                </label>

                <label className="gph-field">
                  <span className="gph-label">Holes</span>
                  <select
                    className="gph-select"
                    value={nine}
                    onChange={e => setNine(e.target.value)}
                    disabled={!course || nineOptions.length === 0}
                  >
                    {nineOptions.length === 0 && <option value="">—</option>}
                    {nineOptions.map(o => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <section className="gl-detail-section gph-result" aria-live="polite">
              <h2 className="gl-detail-section-title">Strokes</h2>
              {!showResult ? (
                <p className="gph-result-empty">
                  {group.length === 0
                    ? 'Add at least one player to see strokes.'
                    : 'Pick a course and tees to see strokes.'}
                </p>
              ) : (
                <>
                  {metaParts.length > 0 && <p className="gph-meta">{metaParts.join(' · ')}</p>}
                  <div className="gph-strokes-list">
                    {groupResults.map(({ name, strokes }) => (
                      <div key={name} className="gl-stat-row">
                        <Link
                          to={`/golf-leaderboard/player/${encodeURIComponent(name)}`}
                          className="gl-stat-link"
                        >
                          {name}{name === meName && <span className="gph-chip-you"> (you)</span>}
                        </Link>
                        {strokes == null ? (
                          <span className="gl-stat-count">No handicap here</span>
                        ) : (
                          <span className="gph-stroke-val">
                            {strokes} <span className="gph-stroke-unit">{Math.abs(strokes) === 1 ? 'stroke' : 'strokes'}</span>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
