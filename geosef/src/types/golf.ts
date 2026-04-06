// --- Data types ---

export interface Standing {
  rank: number;
  name: string;
  points: number;
  events: number;
  isTied: boolean;
}

export interface LeaderboardData {
  standings: Standing[];
  lastUpdated: string;
}

export interface MonthlyStanding {
  rank: number;
  name: string;
  plusMinus: number | null;
  points: number;
  isTied: boolean;
}

export interface MonthlyData {
  month: string;
  standings: MonthlyStanding[];
}

export interface Round {
  timestamp: string;
  course: string;
  tees: string;
  frontBack: string;
  month: string;
  day: string;
  datePlayed: string;
  score: number;
  playingHandicap: number;
  netScore: number;
  coursePar: number;
  plusMinus: number;
  partner: string;
  monthPlayed: string;
  monthlyCount: number;
  counts?: boolean;
}

export interface HandicapPoint {
  date: string;
  index: number;
}

export interface PlayerDetailData {
  player: string;
  rounds: Round[];
  handicapHistory: HandicapPoint[];
}

// --- Shared utilities ---

const MONTH_ORDER = ['April', 'May', 'June', 'July', 'August'];

export function tagCountingRounds(rounds: Round[]): Round[] {
  const byMonth = new Map<string, Round[]>();
  for (const r of rounds) {
    const key = r.monthPlayed || r.month;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(r);
  }
  const counting = new Set<Round>();
  for (const monthRounds of byMonth.values()) {
    [...monthRounds].sort((a, b) => a.plusMinus - b.plusMinus).slice(0, 2).forEach(r => counting.add(r));
  }
  return rounds.map(r => ({ ...r, counts: counting.has(r) }));
}

export function groupRoundsByMonth(rounds: Round[]): { month: string; rounds: Round[]; monthlyCount: number }[] {
  const map = new Map<string, Round[]>();
  for (const r of rounds) {
    const key = r.monthPlayed || r.month;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return MONTH_ORDER
    .filter(m => map.has(m))
    .map(m => ({
      month: m,
      rounds: map.get(m)!,
      monthlyCount: map.get(m)![0]?.monthlyCount ?? 0,
    }));
}

export function formatPlusMinus(pm: number | null): string {
  if (pm === null) return '—';
  if (pm > 0) return `+${pm}`;
  return `${pm}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
