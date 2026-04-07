import React from 'react';
import type { Standing, MonthlyStanding, MonthlyBreakdown } from '../../types/golf';

export const NON_MEMBER_PARTNER = 'Other (GGC Member)';

export function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
}

export function pmScoreClass(pm: number): string {
  return pm < 0 ? 'gl-score-under' : 'gl-score-even';
}

/** Generic frequency counter — maps items to a sorted [{value, count}] array. */
export function countBy<T>(items: T[], key: (item: T) => string | null | undefined): { value: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <div className="gl-search-row">
      <input
        type="text"
        className="gl-search-input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && <button className="gl-search-clear" onClick={() => onChange('')}>✕</button>}
    </div>
  );
}

export type SortKey =
  | 'rank' | 'name' | 'points'
  | 'april' | 'may' | 'june' | 'july' | 'august'
  | 'theOpen' | 'captainsCup'
  | 'plusMinus';

export type SortDir = 'asc' | 'desc';

export function sortStandings<T extends { rank: number; name: string; points: number }>(
  rows: T[],
  key: SortKey | string,
  dir: SortDir,
  _tab: string,
): T[] {
  if (key === 'rank') {
    return dir === 'asc' ? [...rows] : [...rows].reverse();
  }
  return [...rows].sort((a, b) => {
    if (key === 'name') {
      const cmp = a.name.localeCompare(b.name);
      return dir === 'asc' ? cmp : -cmp;
    }
    let aVal: number;
    let bVal: number;
    if (key === 'points') {
      aVal = a.points;
      bVal = b.points;
    } else if (key === 'plusMinus') {
      const aPm = (a as unknown as MonthlyStanding).plusMinus;
      const bPm = (b as unknown as MonthlyStanding).plusMinus;
      aVal = aPm ?? Infinity;
      bVal = bPm ?? Infinity;
    } else {
      // monthly keys: april, may, june, july, august, theOpen, captainsCup
      aVal = (a as unknown as Standing).monthly?.[key as keyof MonthlyBreakdown] ?? 0;
      bVal = (b as unknown as Standing).monthly?.[key as keyof MonthlyBreakdown] ?? 0;
    }
    if (aVal === bVal) return 0;
    const cmp = aVal < bVal ? -1 : 1;
    return dir === 'asc' ? cmp : -cmp;
  });
}

interface SortThProps {
  label: string;
  sortK: string;
  currentKey: string;
  dir: SortDir;
  onSort: (k: string) => void;
  className?: string;
  /** When true, ascending = ↓ (lower is better: rank, plusMinus) */
  invertArrow?: boolean;
}

export function SortTh({ label, sortK, currentKey, dir, onSort, className, invertArrow }: SortThProps) {
  const isActive = sortK === currentKey;
  let indicator: string | null = null;
  if (isActive) {
    const goingDown = invertArrow ? dir === 'asc' : dir === 'desc';
    indicator = goingDown ? '↓' : '↑';
  }
  return (
    <th
      className={['gl-th-sortable', isActive ? 'gl-th-active' : '', className].filter(Boolean).join(' ')}
      onClick={() => onSort(sortK)}
    >
      {label}{indicator && <span className="gl-sort-indicator">{indicator}</span>}
    </th>
  );
}
