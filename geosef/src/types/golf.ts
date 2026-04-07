// --- Data types ---

export interface MonthlyBreakdown {
  april: number;
  may: number;
  june: number;
  theOpen: number;
  july: number;
  captainsCup: number;
  august: number;
}

export interface Standing {
  rank: number;
  name: string;
  points: number;
  events: number;
  isTied: boolean;
  monthly?: MonthlyBreakdown;
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
  player: string;
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

export interface PlayerHandicap {
  player: string;
  current: number | null;
  history: HandicapPoint[];
}

export interface ScoringLogData {
  rounds: Round[];
}

export interface HandicapIndexData {
  players: PlayerHandicap[];
}

export interface CourseVariant {
  name: string;
  frontBack: string;  // "Front", "Back", or "" for 9-hole
  tees: string;       // e.g. "White", "Blue", "Gold"
  par: number;
  slope: number;
  rating: number;
}

export interface CourseVariantData {
  courses: CourseVariant[];
}

export interface CourseInfoEntry {
  name: string;
  fullName: string;
  address: string;
  phone: string;
  teeTimesUrl: string;
  architect: string;
  yearBuilt: string;
}

export interface CourseInfoData {
  courses: CourseInfoEntry[];
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
  // Season-ordered months first, then any extras (e.g. "The Open") sorted by date
  const ordered = MONTH_ORDER.filter(m => map.has(m));
  const extras = [...map.keys()]
    .filter(k => !MONTH_ORDER.includes(k))
    .sort((a, b) => new Date(map.get(a)![0].datePlayed).getTime() - new Date(map.get(b)![0].datePlayed).getTime());
  return [...ordered, ...extras].map(m => ({
    month: m,
    rounds: map.get(m)!,
    monthlyCount: map.get(m)!.length,
  }));
}

export function formatPlusMinus(pm: number | null): string {
  if (pm === null) return '—';
  if (pm > 0) return `+${pm}`;
  if (pm === 0) return 'E';
  return `${pm}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    // Append T12:00:00 so date-only strings aren't shifted by UTC offset
    const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
