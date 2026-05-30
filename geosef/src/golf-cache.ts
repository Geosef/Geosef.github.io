/**
 * Module-level session cache for Apps Script responses.
 * Lives outside React — survives component unmount/remount for the full browser session.
 *
 * Architecture: cache the two raw data sheets (scoringLog + handicapIndex) once,
 * then all player detail views are pure client-side computation — no per-player fetches.
 */
import type { LeaderboardData, MonthlyData, ScoringLogData, HandicapIndexData, CourseVariantData, CourseInfoData, UserPrefs } from './types/golf';
import { APPS_SCRIPT_URL } from './config';

export const sessionCache = {
  season:         null as LeaderboardData | null,
  monthly:        new Map<string, MonthlyData>(),
  scoringLog:     null as ScoringLogData | null,
  handicapIndex:  null as HandicapIndexData | null,
  courseVariants: null as CourseVariantData | null,
  courseInfo:     null as CourseInfoData | null,
  userPrefs:      null as UserPrefs | null,
};

/** Map of cacheable sheet → Apps Script action name. */
const ACTIONS = {
  season:         'leaderboard',
  scoringLog:     'scoringLog',
  handicapIndex:  'handicapIndex',
  courseVariants: 'courses',
  courseInfo:     'courseInfo',
} as const;

type LoadableKey = keyof typeof ACTIONS;

const inflight = new Map<LoadableKey, Promise<unknown>>();

/**
 * Fetch a cached Apps Script sheet exactly once per session.
 *
 * Returns the cached value immediately if present, dedupes concurrent callers
 * (navigating between pages that need the same sheet fires one request),
 * checks `res.ok`, and writes the result into sessionCache. Replaces the ~14
 * hand-rolled fetch/parse/cache blocks that each handled errors differently.
 *
 * Throws on network failure or non-OK status — callers decide whether to
 * surface it (lists show Retry; secondary fetches can swallow it).
 */
export function loadAction<K extends LoadableKey>(
  key: K,
): Promise<NonNullable<(typeof sessionCache)[K]>> {
  const cached = sessionCache[key];
  if (cached) return Promise.resolve(cached as NonNullable<(typeof sessionCache)[K]>);

  const existing = inflight.get(key);
  if (existing) return existing as Promise<NonNullable<(typeof sessionCache)[K]>>;

  const p = fetch(`${APPS_SCRIPT_URL}?action=${ACTIONS[key]}`)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sessionCache as any)[key] = data;
      return data;
    })
    .finally(() => { inflight.delete(key); });

  inflight.set(key, p);
  return p as Promise<NonNullable<(typeof sessionCache)[K]>>;
}
