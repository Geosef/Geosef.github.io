/**
 * Module-level session cache for Apps Script responses.
 * Lives outside React — survives component unmount/remount for the full browser session.
 */
import type { LeaderboardData, MonthlyData, PlayerDetailData } from './types/golf';

export const sessionCache = {
  season:  null as LeaderboardData | null,
  monthly: new Map<string, MonthlyData>(),
  players: new Map<string, PlayerDetailData>(),
};
