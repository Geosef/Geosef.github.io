/**
 * Module-level session cache for Apps Script responses.
 * Lives outside React — survives component unmount/remount for the full browser session.
 *
 * Architecture: cache the two raw data sheets (scoringLog + handicapIndex) once,
 * then all player detail views are pure client-side computation — no per-player fetches.
 */
import type { LeaderboardData, MonthlyData, ScoringLogData, HandicapIndexData } from './types/golf';

export const sessionCache = {
  season:        null as LeaderboardData | null,
  monthly:       new Map<string, MonthlyData>(),
  scoringLog:    null as ScoringLogData | null,
  handicapIndex: null as HandicapIndexData | null,
};
