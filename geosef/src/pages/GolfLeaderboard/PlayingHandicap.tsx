import { useCallback, useEffect, useMemo, useState } from 'react';
import './PlayingHandicap.css';
import type { CourseVariantData, PlayingHandicapData } from '../../types/golf';
import { sessionCache, loadAction } from '../../golf-cache';
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

interface NineOption { key: string; label: string }

interface Result {
  strokes: number | null;
  par: number | null;
  rating: number | null;
  slope: number | null;
}

export default function PlayingHandicap() {
  const { user } = useAuth();
  const [phData, setPhData] = useState<PlayingHandicapData | null>(sessionCache.playingHandicaps);
  const [variants, setVariants] = useState<CourseVariantData | null>(sessionCache.courseVariants);
  const [error, setError] = useState(false);

  const [playerName, setPlayerName] = useState('');
  const [course, setCourse] = useState('');
  const [tees, setTees] = useState('');
  const [nine, setNine] = useState('');
  // Only auto-pick the signed-in user once — don't fight a manual change.
  const [userDefaulted, setUserDefaulted] = useState(false);

  const load = useCallback(() => {
    setError(false);
    loadAction('playingHandicaps').then(setPhData).catch(() => setError(true));
    loadAction('courseVariants').then(setVariants).catch(() => setError(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const players = useMemo(() => {
    const list = phData?.players ?? [];
    return [...list].sort((a, b) => a.player.localeCompare(b.player));
  }, [phData]);

  // Default to the signed-in user via best-effort name match; silent no-op if
  // their Google display name doesn't line up with a roster name.
  useEffect(() => {
    if (userDefaulted || playerName || !user || !players.length) return;
    const target = normalizeName(user.name);
    const match = players.find(p => normalizeName(p.player) === target);
    if (match) setPlayerName(match.player);
    setUserDefaulted(true);
  }, [user, players, playerName, userDefaulted]);

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

  const selectedPlayer = players.find(p => p.player === playerName) ?? null;

  const result = useMemo<Result | null>(() => {
    if (!selectedPlayer || !course || !tees || !variants) return null;
    const findVar = (fb: string) =>
      variants.courses.find(v => v.name === course && v.tees === tees && v.frontBack === fb) ?? null;
    const hcp = selectedPlayer.handicaps;

    if (nine === '18') {
      const f = hcp[variantKey(course, tees, 'Front')];
      const b = hcp[variantKey(course, tees, 'Back')];
      const fv = findVar('Front');
      const bv = findVar('Back');
      if (f == null || b == null) return { strokes: null, par: null, rating: null, slope: null };
      return {
        strokes: f + b,
        par: fv && bv ? fv.par + bv.par : null,
        rating: fv && bv ? Math.round((fv.rating + bv.rating) * 10) / 10 : null,
        slope: null, // slope doesn't sum meaningfully across nines
      };
    }

    const v = findVar(nine);
    const strokes = hcp[variantKey(course, tees, nine)];
    return {
      strokes: strokes == null ? null : strokes,
      par: v?.par ?? null,
      rating: v?.rating ?? null,
      slope: v?.slope ?? null,
    };
  }, [selectedPlayer, course, tees, nine, variants]);

  const loading = !phData || !variants;
  const noData = !loading && players.length === 0;

  const metaParts: string[] = [];
  if (result?.par != null) metaParts.push(`Par ${result.par}`);
  if (result?.rating != null) metaParts.push(`Rating ${result.rating.toFixed(1)}`);
  if (result?.slope != null) metaParts.push(`Slope ${result.slope}`);

  return (
    <div className="gl-wrapper">
      <div className="gph-head">
        <h1 className="gph-title">Playing Handicaps</h1>
        <p className="gph-sub">Strokes you’ll receive before a round — pick a player, course, and tees.</p>
      </div>

      <div className="gl-content">
        {error && loading ? (
          <ListError onRetry={load} />
        ) : loading ? (
          <div className="gl-loading">Loading…</div>
        ) : noData ? (
          <div className="gl-loading">No handicap data available yet.</div>
        ) : (
          <div className="gph">
            <div className="gph-controls">
              <label className="gph-field">
                <span className="gph-label">Player</span>
                <select
                  className="gph-select"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                >
                  <option value="">Select player…</option>
                  {players.map(p => (
                    <option key={p.player} value={p.player}>{p.player}</option>
                  ))}
                </select>
              </label>

              <label className="gph-field">
                <span className="gph-label">Course</span>
                <select
                  className="gph-select"
                  value={course}
                  onChange={e => setCourse(e.target.value)}
                >
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

            <div className="gph-result" aria-live="polite">
              {!selectedPlayer || !course ? (
                <p className="gph-result-empty">Select a player and course to see strokes.</p>
              ) : result?.strokes == null ? (
                <p className="gph-result-empty">
                  No handicap on file for {selectedPlayer.player} at these tees.
                </p>
              ) : (
                <>
                  <div className="gph-strokes">
                    <span className="gph-strokes-num">{result.strokes}</span>
                    <span className="gph-strokes-unit">
                      {Math.abs(result.strokes) === 1 ? 'stroke' : 'strokes'}
                    </span>
                  </div>
                  <p className="gph-result-sub">
                    {selectedPlayer.player}
                    {selectedPlayer.current != null && (
                      <span className="gph-index"> · Index {selectedPlayer.current.toFixed(1)}</span>
                    )}
                  </p>
                  {metaParts.length > 0 && (
                    <p className="gph-meta">{metaParts.join(' · ')}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
