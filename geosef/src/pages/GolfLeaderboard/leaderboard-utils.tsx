import React from 'react';
import { Star } from 'lucide-react';
import type { Standing, MonthlyStanding, MonthlyBreakdown } from '../../types/golf';

export const NON_MEMBER_PARTNER = 'Other (GGC Member)';

/**
 * Jump back to row 1 after a re-sort — otherwise you're left stranded in the
 * middle of a list whose rows all just changed under you. Table pages scroll
 * inside .gl-table-scroll; the window is reset too for anything that doesn't.
 *
 * Deliberately instant: the rows are all different after a sort, so animating
 * the trip past them conveys nothing and just delays the new order.
 */
export function scrollToListTop() {
  document.querySelector('.gl-table-scroll')?.scrollTo({ top: 0, behavior: 'auto' });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

interface StickyListHeaderProps {
  title: string;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  children?: React.ReactNode;
}

export function StickyListHeader({ title, search, children }: StickyListHeaderProps) {
  return (
    <div className="gl-sticky-list-header">
      <div className={`gl-header${search ? ' gl-header--with-search' : ''}`}>
        <h1 className="gl-title">{title}</h1>
        {search && (
          <SearchInput value={search.value} onChange={search.onChange} placeholder={search.placeholder} />
        )}
      </div>
      {children}
    </div>
  );
}

/** Segmented "All | ★ Favorites (N)" control for list pages. */
export function FavoritesToggle({
  favOnly,
  onChange,
  count,
}: { favOnly: boolean; onChange: (v: boolean) => void; count: number }) {
  return (
    <div className="gl-fav-filter-row">
      <div className="gl-fav-filter" role="group" aria-label="Filter by favorites">
        <button
          type="button"
          className={`gl-fav-filter-btn${!favOnly ? ' gl-fav-filter-btn--active' : ''}`}
          aria-pressed={!favOnly}
          onClick={() => onChange(false)}
        >
          All
        </button>
        <button
          type="button"
          className={`gl-fav-filter-btn${favOnly ? ' gl-fav-filter-btn--active' : ''}`}
          aria-pressed={favOnly}
          onClick={() => onChange(true)}
        >
          <Star size={13} /> Favorites {count}
        </button>
      </div>
    </div>
  );
}

/** Full-width error state for list pages, with a Retry affordance. */
export function ListError({
  onRetry,
  message = "Couldn't load this list. Check your connection and try again.",
}: { onRetry: () => void; message?: string }) {
  return (
    <div className="gl-error gl-error--list" role="alert">
      <span>{message}</span>
      <button className="gl-retry-btn" onClick={onRetry}>Retry</button>
    </div>
  );
}

/** A single full-width table row for empty / no-match states. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr className="gl-empty-row">
      <td colSpan={colSpan} className="gl-empty-cell">{children}</td>
    </tr>
  );
}

export function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
}

export function pmScoreClass(pm: number): string {
  return pm < 0 ? 'gl-score-under' : 'gl-score-even';
}

export function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`gl-chip ${className}`.trim()}>{children}</span>;
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
      const cmp = lastName(a.name).localeCompare(lastName(b.name));
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
  let ariaSort: 'none' | 'ascending' | 'descending' = 'none';
  if (isActive) {
    const goingDown = invertArrow ? dir === 'asc' : dir === 'desc';
    indicator = goingDown ? '↓' : '↑';
    ariaSort = goingDown ? 'descending' : 'ascending';
  }
  const activate = () => onSort(sortK);
  return (
    <th
      className={['gl-th-sortable', isActive ? 'gl-th-active' : '', className].filter(Boolean).join(' ')}
      aria-sort={ariaSort}
      onClick={activate}
    >
      <span
        className="gl-th-btn"
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        }}
      >
        {label}{indicator && <span className="gl-sort-indicator">{indicator}</span>}
      </span>
    </th>
  );
}
