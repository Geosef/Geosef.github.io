import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './GolfLeaderboard.css';
import type { LeaderboardData, MonthlyData, Round, ScoringLogData, HandicapIndexData, Standing } from '../../types/golf';
import { tagCountingRounds, groupRoundsByMonth, formatPlusMinus, formatDate } from '../../types/golf';
import { APPS_SCRIPT_URL } from '../../config';
import { sessionCache } from '../../golf-cache';

const CUT_LINE_POSITION = 48;

type ActiveTab = 'season' | 'april' | 'may' | 'june' | 'july' | 'august';

const MONTH_TABS = [
  { key: 'april'  as ActiveTab, label: 'Apr', param: 'April',  month: 3 },
  { key: 'may'    as ActiveTab, label: 'May', param: 'May',    month: 4 },
  { key: 'june'   as ActiveTab, label: 'Jun', param: 'June',   month: 5 },
  { key: 'july'   as ActiveTab, label: 'Jul', param: 'July',   month: 6 },
  { key: 'august' as ActiveTab, label: 'Aug', param: 'August', month: 7 },
];

function getActiveMonthTab(): ActiveTab {
  const m = new Date().getMonth(); // 0-indexed
  return (MONTH_TABS.find(t => t.month >= m) ?? MONTH_TABS[MONTH_TABS.length - 1]).key;
}

function isFutureMonth(tab: typeof MONTH_TABS[number]): boolean {
  return tab.month > new Date().getMonth();
}

function formatRank(isTied: boolean, rank: number): string {
  return isTied ? `T${rank}` : `${rank}`;
}

function formatPoints(points: number): string {
  return Math.round(points).toString();
}

function pmScoreClass(pm: number): string {
  return pm < 0 ? 'gl-score-under' : 'gl-score-even';
}

function getMonthlyR1R2(playerName: string, monthParam: string): { r1: number | null; r2: number | null } {
  const log = sessionCache.scoringLog;
  if (!log) return { r1: null, r2: null };
  const rounds = log.rounds.filter(r => r.player === playerName && (r.monthPlayed || r.month) === monthParam);
  const tagged = tagCountingRounds(rounds);
  const counting = tagged.filter(r => r.counts).sort((a, b) => a.plusMinus - b.plusMinus);
  return {
    r1: counting[0]?.plusMinus ?? null,
    r2: counting[1]?.plusMinus ?? null,
  };
}

// ── Expanded rounds sub-component ──

function RoundRow({ round }: { round: Round }) {
  return (
    <div className={`gl-round-row ${round.counts ? 'gl-round-counting' : 'gl-round-other'}`}>
      <span className="gl-round-check">{round.counts ? '✓' : '·'}</span>
      <span className="gl-round-date">{formatDate(round.datePlayed)}</span>
      <span className="gl-round-course">
        {round.course}{round.tees ? ` (${round.tees})` : ''}
      </span>
      <span className={`gl-round-scores ${pmScoreClass(round.plusMinus)}`}>
        {round.score} / {round.netScore} ({formatPlusMinus(round.plusMinus)})
      </span>
      <span className="gl-round-hcp">HCP {round.playingHandicap}</span>
      {round.partner && <span className="gl-round-partner">w/ {round.partner}</span>}
    </div>
  );
}

function ExpandedRounds({ rounds, tab }: { rounds: Round[]; tab: ActiveTab }) {
  const tagged = tagCountingRounds(rounds);

  if (tab === 'season') {
    const groups = groupRoundsByMonth(tagged);
    if (groups.length === 0) {
      return <div className="gl-expanded-rounds"><p className="gl-round-empty">No rounds recorded.</p></div>;
    }
    return (
      <div className="gl-expanded-rounds">
        {groups.map(({ month, rounds: monthRounds, monthlyCount }) => {
          const countingCount = monthRounds.filter(r => r.counts).length;
          return (
            <div key={month} className="gl-round-group">
              <div className="gl-round-group-header">
                {month}
                <span className="gl-round-group-meta">
                  {countingCount} of {monthlyCount} round{monthlyCount !== 1 ? 's' : ''} count
                </span>
              </div>
              {monthRounds.map((r, i) => <RoundRow key={i} round={r} />)}
            </div>
          );
        })}
      </div>
    );
  }

  // Monthly tab: only show rounds for that month
  const monthParam = MONTH_TABS.find(m => m.key === tab)?.param ?? '';
  const monthRounds = tagged.filter(r => (r.monthPlayed || r.month) === monthParam);
  const monthlyCount = monthRounds[0]?.monthlyCount ?? 0;
  const countingCount = monthRounds.filter(r => r.counts).length;

  return (
    <div className="gl-expanded-rounds">
      {monthRounds.length > 0 ? (
        <div className="gl-round-group">
          <div className="gl-round-group-header">
            {monthParam}
            <span className="gl-round-group-meta">
              {countingCount} of {monthlyCount} round{monthlyCount !== 1 ? 's' : ''} count
            </span>
          </div>
          {monthRounds.map((r, i) => <RoundRow key={i} round={r} />)}
        </div>
      ) : (
        <p className="gl-round-empty">No rounds for {monthParam}.</p>
      )}
    </div>
  );
}

// ── Main component ──

export default function GolfLeaderboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const tab = searchParams.get('tab') as ActiveTab;
    if (tab === 'season') return 'season';
    if (MONTH_TABS.some(m => m.key === tab)) return tab;
    return getActiveMonthTab();
  });

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    if (tab === 'season') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  }
  const [seasonData, setSeasonData] = useState<LeaderboardData | null>(sessionCache.season);
  const [monthlyCache, setMonthlyCache] = useState(new Map(sessionCache.monthly));
  const [, setScoringLogLoaded] = useState(sessionCache.scoringLog !== null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchSeason = useCallback(async () => {
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=leaderboard`);
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LeaderboardData = JSON.parse(text);
      sessionCache.season = data;
      setSeasonData(data);
      setError(null);
      setIsLive(true);
      setTimeout(() => setIsLive(false), 3000);
    } catch {
      setError('Could not load leaderboard. Will retry.');
    }
  }, []);

  useEffect(() => {
    if (!sessionCache.season) fetchSeason();
  }, [fetchSeason]);

  // Fetch scoring log in the background — powers expanded round views and R1/R2 columns
  useEffect(() => {
    if (sessionCache.scoringLog) return;
    fetch(`${APPS_SCRIPT_URL}?action=scoringLog`)
      .then(r => r.json())
      .then((data: ScoringLogData) => {
        sessionCache.scoringLog = data;
        setScoringLogLoaded(true);
      })
      .catch(() => {});
  }, []);

  // Fetch handicap index in the background — powers player detail pages
  useEffect(() => {
    if (sessionCache.handicapIndex) return;
    fetch(`${APPS_SCRIPT_URL}?action=handicapIndex`)
      .then(r => r.json())
      .then((data: HandicapIndexData) => { sessionCache.handicapIndex = data; })
      .catch(() => {});
  }, []);

  // Fetch monthly data when tab changes (session-cached)
  useEffect(() => {
    if (activeTab === 'season') return;
    const monthTab = MONTH_TABS.find(m => m.key === activeTab);
    if (!monthTab || sessionCache.monthly.has(monthTab.param)) return;

    fetch(`${APPS_SCRIPT_URL}?action=monthly&month=${monthTab.param}`)
      .then(r => r.json())
      .then((data: MonthlyData) => {
        sessionCache.monthly.set(monthTab.param, data);
        setMonthlyCache(new Map(sessionCache.monthly));
      })
      .catch(() => {});
  }, [activeTab]);

  // When expanding a row, show loading only if scoring log isn't ready yet
  useEffect(() => {
    if (!expandedPlayer) return;
    setLoadingDetail(!sessionCache.scoringLog);
    if (sessionCache.scoringLog) return;

    // If scoring log is still in flight, wait for it
    const interval = setInterval(() => {
      if (sessionCache.scoringLog) {
        setScoringLogLoaded(true);
        setLoadingDetail(false);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [expandedPlayer]);

  function handleRowClick(name: string) {
    setExpandedPlayer(prev => (prev === name ? null : name));
  }

  const monthTab = MONTH_TABS.find(m => m.key === activeTab);
  const currentMonthData = monthTab ? monthlyCache.get(monthTab.param) : undefined;
  const standings = activeTab === 'season'
    ? (seasonData?.standings ?? [])
    : (currentMonthData?.standings ?? []);

  const isMonthTab = activeTab !== 'season';
  const colCount = isMonthTab ? 5 : 10;

  return (
    <div className="gl-wrapper">
      <div className="gl-header">
        <div className="gl-header-top">
          <span className="gl-flag">⛳</span>
          <div>
            <h1 className="gl-title">GGC Outdoor League</h1>
            <p className="gl-subtitle">2026 Season Standings</p>
          </div>
          <span className="gl-flag">⛳</span>
        </div>
        <div className="gl-meta">
          {isLive && <span className="gl-live-badge">● LIVE</span>}
          {seasonData?.lastUpdated && (
            <span className="gl-updated">Updated {seasonData.lastUpdated}</span>
          )}
          <button className="gl-refresh-btn" onClick={fetchSeason} title="Refresh">↻</button>
        </div>
      </div>

      <div className="gl-tabs">
        {MONTH_TABS.map(m => {
          const future = isFutureMonth(m);
          return (
            <button
              key={m.key}
              className={`gl-tab ${activeTab === m.key ? 'gl-tab-active' : ''} ${future ? 'gl-tab-disabled' : ''}`}
              onClick={() => !future && handleTabChange(m.key)}
              disabled={future}
            >
              {m.label}
            </button>
          );
        })}
        <button
          className={`gl-tab ${activeTab === 'season' ? 'gl-tab-active' : ''}`}
          onClick={() => handleTabChange('season')}
        >
          Season
        </button>
      </div>

      <div className="gl-content">
        {error && <div className="gl-error">{error}</div>}

        {standings.length > 0 ? (
          <table className="gl-table">
            <thead>
              <tr>
                <th className="gl-col-rank">POS</th>
                <th className="gl-col-name">PLAYER</th>
                {isMonthTab ? (
                  <>
                    <th className="gl-col-r1">R1</th>
                    <th className="gl-col-r2">R2</th>
                  </>
                ) : (
                  <>
                    <th className="gl-col-month">APR</th>
                    <th className="gl-col-month">MAY</th>
                    <th className="gl-col-month">JUN</th>
                    <th className="gl-col-month gl-col-major">OPEN</th>
                    <th className="gl-col-month">JUL</th>
                    <th className="gl-col-month gl-col-major">CC</th>
                    <th className="gl-col-month">AUG</th>
                  </>
                )}
                <th className="gl-col-points">{isMonthTab ? 'PTS' : 'TOTAL'}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => {
                const expandedRounds = expandedPlayer === s.name && sessionCache.scoringLog
                  ? sessionCache.scoringLog.rounds.filter(r => r.player === s.name)
                  : null;
                const r1r2 = isMonthTab
                  ? getMonthlyR1R2(s.name, monthTab?.param ?? '')
                  : null;

                return (
                  <React.Fragment key={s.name}>
                    {i === CUT_LINE_POSITION && (
                      <tr className="gl-cut-row">
                        <td colSpan={colCount} className="gl-cut-label">✂ CUT</td>
                      </tr>
                    )}
                    <tr
                      className={[
                        'gl-row',
                        i === 0 ? 'gl-row-leader' : '',
                        i % 2 === 0 ? 'gl-row-even' : '',
                        expandedPlayer === s.name ? 'gl-row-is-expanded' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleRowClick(s.name)}
                    >
                      <td className="gl-col-rank">{formatRank(s.isTied, s.rank)}</td>
                      <td className="gl-col-name">
                        <Link
                          to={`/golf-leaderboard/player/${encodeURIComponent(s.name)}`}
                          className="gl-player-link"
                          onClick={e => e.stopPropagation()}
                        >
                          {s.name}
                        </Link>
                      </td>
                      {isMonthTab ? (
                        <>
                          <td className={`gl-col-r1${r1r2!.r1 !== null ? ' ' + pmScoreClass(r1r2!.r1) : ''}`}>
                            {r1r2!.r1 !== null ? formatPlusMinus(r1r2!.r1) : '—'}
                          </td>
                          <td className={`gl-col-r2${r1r2!.r2 !== null ? ' ' + pmScoreClass(r1r2!.r2) : ''}`}>
                            {r1r2!.r2 !== null ? formatPlusMinus(r1r2!.r2) : '—'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="gl-col-month">{(s as Standing).monthly?.april ? Math.round((s as Standing).monthly!.april) : '—'}</td>
                          <td className="gl-col-month">{(s as Standing).monthly?.may ? Math.round((s as Standing).monthly!.may) : '—'}</td>
                          <td className="gl-col-month">{(s as Standing).monthly?.june ? Math.round((s as Standing).monthly!.june) : '—'}</td>
                          <td className="gl-col-month">{(s as Standing).monthly?.theOpen ? Math.round((s as Standing).monthly!.theOpen) : '—'}</td>
                          <td className="gl-col-month">{(s as Standing).monthly?.july ? Math.round((s as Standing).monthly!.july) : '—'}</td>
                          <td className="gl-col-month">{(s as Standing).monthly?.captainsCup ? Math.round((s as Standing).monthly!.captainsCup) : '—'}</td>
                          <td className="gl-col-month">{(s as Standing).monthly?.august ? Math.round((s as Standing).monthly!.august) : '—'}</td>
                        </>
                      )}
                      <td className="gl-col-points">{formatPoints(s.points)}</td>
                    </tr>

                    {expandedPlayer === s.name && (
                      <tr className="gl-row-detail">
                        <td colSpan={colCount}>
                          {loadingDetail ? (
                            <div className="gl-detail-loading">Loading rounds…</div>
                          ) : expandedRounds ? (
                            <ExpandedRounds rounds={expandedRounds} tab={activeTab} />
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          !error && <div className="gl-loading">Loading standings…</div>
        )}
      </div>
    </div>
  );
}
