# Live Trading Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the live trading page into a tabbed interface (Overview, Trades, Calendar, Performance) with comprehensive analytics matching the backtest report view.

**Architecture:** Trade history is fetched once with `days=3650` and shared across all tabs. A pure `trade-stats.ts` module handles all calculations. Each tab is an independent component consuming the shared history. The `useLiveData` hook is updated with dual polling intervals (5s for real-time data, 60s for history).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Recharts, date-fns, lucide-react

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `app/lib/trade-stats.ts` | Pure functions: net profit, profit factor, win rate, drawdown, daily/monthly groupings, win streaks, running balance |
| `app/components/live/LiveTabs.tsx` | Tab bar component with hash-based routing |
| `app/components/live/OverviewTab.tsx` | Overview tab: stat cards + equity curve |
| `app/components/live/TradesTab.tsx` | Trades tab: filtered table with pagination + running balance |
| `app/components/live/CalendarTab.tsx` | Calendar tab: monthly view + win streaks |
| `app/components/live/PerformanceTab.tsx` | Performance grid: year × month P/L |

### Modified Files

| File | Change |
|------|--------|
| `app/hooks/useLiveData.ts` | Dual polling: 5s for account/positions/health, 60s for history. Default days=3650. |
| `app/live/page.tsx` | Restructure layout: panel → positions → tabs. Remove old chart/table imports. |

### Files to Remove

| File | Reason |
|------|--------|
| `app/components/live/LiveEquityChart.tsx` | Replaced by OverviewTab |
| `app/components/live/LiveTradesTable.tsx` | Replaced by TradesTab |

---

### Task 1: Create Trade Stats Library

**Files:**
- Create: `app/lib/trade-stats.ts`

- [ ] **Step 1: Create `app/lib/trade-stats.ts`**

```typescript
import { LiveTrade } from './live-types';

export interface TradeStats {
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  totalTrades: number;
  winRate: number;
  expectedPayoff: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  totalCommissionSwap: number;
  bestTrade: number;
  worstTrade: number;
}

export interface DailyPnl {
  date: string; // YYYY-MM-DD
  pnl: number;
  trades: number;
  wins: number;
}

export interface MonthlyPnl {
  year: number;
  month: number; // 0-11
  pnl: number;
  trades: number;
}

export interface WinStreaks {
  currentDays: number;
  maxDays: number;
  currentTrades: number;
  maxTrades: number;
}

export function calculateStats(trades: LiveTrade[], startingCapital: number): TradeStats {
  if (trades.length === 0) {
    return {
      netProfit: 0, grossProfit: 0, grossLoss: 0, profitFactor: 0,
      totalTrades: 0, winRate: 0, expectedPayoff: 0,
      maxDrawdown: 0, maxDrawdownPct: 0, totalCommissionSwap: 0,
      bestTrade: 0, worstTrade: 0,
    };
  }

  let grossProfit = 0;
  let grossLoss = 0;
  let totalCommissionSwap = 0;
  let bestTrade = -Infinity;
  let worstTrade = Infinity;

  for (const t of trades) {
    const net = t.profit + t.commission + t.swap;
    if (net > 0) grossProfit += net;
    else grossLoss += Math.abs(net);
    totalCommissionSwap += t.commission + t.swap;
    if (net > bestTrade) bestTrade = net;
    if (net < worstTrade) worstTrade = net;
  }

  const netProfit = grossProfit - grossLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const wins = trades.filter(t => (t.profit + t.commission + t.swap) > 0).length;
  const winRate = (wins / trades.length) * 100;
  const expectedPayoff = netProfit / trades.length;

  // Max drawdown from equity curve
  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
  let equity = startingCapital;
  let peak = equity;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;

  for (const t of sorted) {
    equity += t.profit + t.commission + t.swap;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      maxDrawdownPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  return {
    netProfit, grossProfit, grossLoss, profitFactor,
    totalTrades: trades.length, winRate, expectedPayoff,
    maxDrawdown, maxDrawdownPct, totalCommissionSwap,
    bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
    worstTrade: worstTrade === Infinity ? 0 : worstTrade,
  };
}

export function calculateRunningBalance(trades: LiveTrade[], startingCapital: number): { trade: LiveTrade; balance: number }[] {
  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
  let balance = startingCapital;
  return sorted.map(trade => {
    balance += trade.profit + trade.commission + trade.swap;
    return { trade, balance };
  });
}

export function calculateEquityCurve(trades: LiveTrade[], startingCapital: number): { time: string; value: number }[] {
  if (trades.length === 0) return [];

  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
  const points: { time: string; value: number }[] = [{ time: sorted[0].close_time, value: startingCapital }];

  let running = startingCapital;
  for (const t of sorted) {
    running += t.profit + t.commission + t.swap;
    points.push({ time: t.close_time, value: running });
  }

  return points;
}

export function groupByDay(trades: LiveTrade[]): DailyPnl[] {
  const map = new Map<string, DailyPnl>();

  for (const t of trades) {
    const date = t.close_time.slice(0, 10); // YYYY-MM-DD
    const existing = map.get(date);
    const net = t.profit + t.commission + t.swap;
    if (existing) {
      existing.pnl += net;
      existing.trades += 1;
      if (net > 0) existing.wins += 1;
    } else {
      map.set(date, { date, pnl: net, trades: 1, wins: net > 0 ? 1 : 0 });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function groupByMonth(trades: LiveTrade[]): MonthlyPnl[] {
  const map = new Map<string, MonthlyPnl>();

  for (const t of trades) {
    const year = parseInt(t.close_time.slice(0, 4), 10);
    const month = parseInt(t.close_time.slice(5, 7), 10) - 1; // 0-based
    const key = `${year}-${month}`;
    const existing = map.get(key);
    const net = t.profit + t.commission + t.swap;
    if (existing) {
      existing.pnl += net;
      existing.trades += 1;
    } else {
      map.set(key, { year, month, pnl: net, trades: 1 });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

export function calculateWinStreaks(trades: LiveTrade[]): WinStreaks {
  const daily = groupByDay(trades);

  let currentDays = 0;
  let maxDays = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].pnl > 0) {
      if (i === daily.length - 1 || currentDays > 0) currentDays++;
    } else {
      if (currentDays > maxDays) maxDays = currentDays;
      if (i < daily.length - 1) break;
      currentDays = 0;
    }
  }
  if (currentDays > maxDays) maxDays = currentDays;

  // Recalculate max from all streaks
  let streak = 0;
  let bestDayStreak = 0;
  for (const d of daily) {
    if (d.pnl > 0) { streak++; if (streak > bestDayStreak) bestDayStreak = streak; }
    else { streak = 0; }
  }

  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
  let currentTrades = 0;
  let maxTrades = 0;
  let tradeStreak = 0;
  let bestTradeStreak = 0;

  for (const t of sorted) {
    const net = t.profit + t.commission + t.swap;
    if (net > 0) { tradeStreak++; if (tradeStreak > bestTradeStreak) bestTradeStreak = tradeStreak; }
    else { tradeStreak = 0; }
  }
  // Current trade streak (from end)
  for (let i = sorted.length - 1; i >= 0; i--) {
    const net = sorted[i].profit + sorted[i].commission + sorted[i].swap;
    if (net > 0) currentTrades++;
    else break;
  }

  return {
    currentDays,
    maxDays: bestDayStreak,
    currentTrades,
    maxTrades: bestTradeStreak,
  };
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/lib/trade-stats.ts
git commit -m "feat: add trade stats calculation library"
```

---

### Task 2: Update useLiveData Hook with Dual Polling

**Files:**
- Modify: `app/hooks/useLiveData.ts`

- [ ] **Step 1: Replace `app/hooks/useLiveData.ts` entirely**

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { LiveDataState, LiveAccountInfo, LivePosition, LiveTrade } from '../lib/live-types';

const FAST_INTERVAL = 5_000;   // 5s for account, positions, health
const SLOW_INTERVAL = 60_000;  // 60s for trade history
const HISTORY_DAYS = 3650;     // 10 years

export function useLiveData(accountId: string | null): LiveDataState {
  const [state, setState] = useState<LiveDataState>({
    status: 'connecting',
    account: null,
    positions: [],
    history: [],
    lastUpdated: null,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const lastHistory = useRef<LiveTrade[]>([]);

  useEffect(() => {
    setState({
      status: 'connecting',
      account: null,
      positions: [],
      history: [],
      lastUpdated: null,
      error: null,
    });
    lastHistory.current = [];

    if (!accountId) return;

    let fastTimeout: ReturnType<typeof setTimeout>;
    let slowTimeout: ReturnType<typeof setTimeout>;
    let historyLoaded = false;

    const q = `accountId=${encodeURIComponent(accountId)}`;

    async function pollFast() {
      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      try {
        const [healthRes, accountRes, positionsRes] = await Promise.all([
          fetch(`/api/live/health?${q}`, { signal }),
          fetch(`/api/live/account?${q}`, { signal }),
          fetch(`/api/live/positions?${q}`, { signal }),
        ]);

        if (signal.aborted) return;

        if (!healthRes.ok) {
          setState(prev => ({ ...prev, status: 'offline', error: 'MT5 disconnected' }));
          scheduleFast();
          return;
        }

        const account: LiveAccountInfo | null = accountRes.ok ? await accountRes.json() : null;
        const positions: LivePosition[] = positionsRes.ok ? await positionsRes.json() : [];

        setState(prev => ({
          ...prev,
          status: 'online',
          account,
          positions,
          lastUpdated: new Date(),
          error: null,
        }));
      } catch (err) {
        if (signal.aborted) return;
        setState(prev => ({
          ...prev,
          status: 'offline',
          error: err instanceof Error ? err.message : 'Connection failed',
        }));
      }

      scheduleFast();
    }

    async function pollHistory() {
      try {
        const res = await fetch(`/api/live/history?${q}&days=${HISTORY_DAYS}`);
        if (res.ok) {
          const history: LiveTrade[] = await res.json();
          lastHistory.current = history;
          setState(prev => ({ ...prev, history }));
        }
      } catch {
        // Keep last known history
      }

      scheduleSlow();
    }

    function scheduleFast() {
      fastTimeout = setTimeout(pollFast, FAST_INTERVAL);
    }

    function scheduleSlow() {
      slowTimeout = setTimeout(pollHistory, SLOW_INTERVAL);
    }

    // Initial load: fetch everything in parallel
    async function init() {
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      try {
        const [healthRes, accountRes, positionsRes, historyRes] = await Promise.all([
          fetch(`/api/live/health?${q}`, { signal }),
          fetch(`/api/live/account?${q}`, { signal }),
          fetch(`/api/live/positions?${q}`, { signal }),
          fetch(`/api/live/history?${q}&days=${HISTORY_DAYS}`, { signal }),
        ]);

        if (signal.aborted) return;

        const isOnline = healthRes.ok;
        const account: LiveAccountInfo | null = accountRes.ok ? await accountRes.json() : null;
        const positions: LivePosition[] = positionsRes.ok ? await positionsRes.json() : [];

        let history = lastHistory.current;
        if (historyRes.ok) {
          history = await historyRes.json();
          lastHistory.current = history;
          historyLoaded = true;
        }

        setState({
          status: isOnline ? 'online' : 'offline',
          account,
          positions,
          history,
          lastUpdated: new Date(),
          error: isOnline ? null : 'MT5 disconnected',
        });
      } catch (err) {
        if (signal.aborted) return;
        setState(prev => ({
          ...prev,
          status: 'offline',
          error: err instanceof Error ? err.message : 'Connection failed',
        }));
      }

      // Start separate polling loops
      scheduleFast();
      scheduleSlow();
    }

    init();

    return () => {
      clearTimeout(fastTimeout);
      clearTimeout(slowTimeout);
      abortRef.current?.abort();
    };
  }, [accountId]);

  return state;
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build will fail because `page.tsx` calls `useLiveData(accountId, historyDays)` with two args. Expected — fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add app/hooks/useLiveData.ts
git commit -m "feat: update useLiveData with dual polling intervals"
```

---

### Task 3: Create LiveTabs Component

**Files:**
- Create: `app/components/live/LiveTabs.tsx`

- [ ] **Step 1: Create `app/components/live/LiveTabs.tsx`**

```typescript
'use client';

export type TabId = 'overview' | 'trades' | 'calendar' | 'performance';

interface LiveTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'trades', label: 'Trades' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'performance', label: 'Performance' },
];

export default function LiveTabs({ activeTab, onTabChange }: LiveTabsProps) {
  return (
    <div className="flex gap-0 border-b border-border">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.5px] transition-colors border-b-2 -mb-px ${
            activeTab === tab.id
              ? 'text-accent border-b-accent'
              : 'text-text-muted border-b-transparent hover:text-text-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds (component not imported anywhere yet).

- [ ] **Step 3: Commit**

```bash
git add app/components/live/LiveTabs.tsx
git commit -m "feat: add LiveTabs component with hash-based tab switching"
```

---

### Task 4: Create OverviewTab Component

**Files:**
- Create: `app/components/live/OverviewTab.tsx`

- [ ] **Step 1: Create `app/components/live/OverviewTab.tsx`**

```typescript
'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { LiveTrade } from '../../lib/live-types';
import { calculateStats, calculateEquityCurve } from '../../lib/trade-stats';
import StatCard from '../shared/StatCard';
import EquityChart from '../shared/EquityChart';

interface OverviewTabProps {
  trades: LiveTrade[];
  balance: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

export default function OverviewTab({ trades, balance }: OverviewTabProps) {
  const startingCapital = useMemo(() => {
    const totalPnl = trades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    return balance - totalPnl;
  }, [trades, balance]);

  const stats = useMemo(() => calculateStats(trades, startingCapital), [trades, startingCapital]);

  const equityCurve = useMemo(() => {
    const points = calculateEquityCurve(trades, startingCapital);
    return points.map(p => ({
      time: format(parseISO(p.time), 'MMM d, yyyy'),
      value: p.value,
    }));
  }, [trades, startingCapital]);

  if (trades.length === 0) {
    return (
      <div className="py-16 text-center text-text-muted text-sm">No trades yet</div>
    );
  }

  const pfDisplay = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2);
  const netVariant = stats.netProfit >= 0 ? 'profit' : 'loss';

  return (
    <div className="space-y-6 pt-6">
      {/* Row 1: Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Net Profit" value={formatCurrency(stats.netProfit)} variant={netVariant} />
        <StatCard label="Profit Factor" value={pfDisplay} />
        <StatCard label="Total Trades" value={String(stats.totalTrades)} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
        <StatCard label="Expected Payoff" value={formatCurrency(stats.expectedPayoff)} variant={stats.expectedPayoff >= 0 ? 'profit' : 'loss'} />
      </div>

      {/* Row 2: Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Gross Profit" value={formatCurrency(stats.grossProfit)} variant="profit" />
        <StatCard label="Gross Loss" value={formatCurrency(-stats.grossLoss)} variant="loss" />
        <StatCard
          label="Max Drawdown"
          value={formatCurrency(-stats.maxDrawdown)}
          secondaryValue={`${stats.maxDrawdownPct.toFixed(2)}%`}
          variant="loss"
        />
        <StatCard label="Commission + Swap" value={formatCurrency(stats.totalCommissionSwap)} />
        <StatCard
          label="Best / Worst"
          value={formatCurrency(stats.bestTrade)}
          secondaryValue={formatCurrency(stats.worstTrade)}
        />
      </div>

      {/* Equity curve */}
      {equityCurve.length >= 2 && (
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Equity Curve</h3>
              <p className="text-xs text-text-muted mt-1 font-mono">
                Balance progression from {trades.length} closed trades
              </p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold font-mono ${stats.netProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {stats.netProfit >= 0 ? '+' : ''}{startingCapital > 0 ? ((stats.netProfit / startingCapital) * 100).toFixed(2) : '0.00'}%
              </p>
              <p className={`text-sm font-mono ${stats.netProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {stats.netProfit >= 0 ? '+' : ''}{formatCurrency(stats.netProfit)}
              </p>
            </div>
          </div>
          <EquityChart
            data={equityCurve}
            height={300}
            showReferenceLine={true}
            referenceValue={startingCapital}
            formatXLabel={(v) => v.split(', ')[0] ?? v}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/components/live/OverviewTab.tsx
git commit -m "feat: add OverviewTab with stat cards and equity curve"
```

---

### Task 5: Create TradesTab Component

**Files:**
- Create: `app/components/live/TradesTab.tsx`

- [ ] **Step 1: Create `app/components/live/TradesTab.tsx`**

```typescript
'use client';

import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { LiveTrade } from '../../lib/live-types';
import { calculateRunningBalance } from '../../lib/trade-stats';
import DataTable, { Column } from '../shared/DataTable';
import StatusBadge from '../shared/StatusBadge';

interface TradesTabProps {
  trades: LiveTrade[];
  balance: number;
}

type FilterType = 'all' | 'profit' | 'loss';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(isoString: string): string {
  try { return format(parseISO(isoString), 'yyyy/MM/dd HH:mm:ss'); }
  catch { return isoString; }
}

export default function TradesTab({ trades, balance }: TradesTabProps) {
  const [filterType, setFilterType] = useState<FilterType>('all');

  const startingCapital = useMemo(() => {
    const totalPnl = trades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    return balance - totalPnl;
  }, [trades, balance]);

  const withBalance = useMemo(() => calculateRunningBalance(trades, startingCapital), [trades, startingCapital]);

  const filtered = useMemo(() => {
    if (filterType === 'profit') return withBalance.filter(r => (r.trade.profit + r.trade.commission + r.trade.swap) > 0);
    if (filterType === 'loss') return withBalance.filter(r => (r.trade.profit + r.trade.commission + r.trade.swap) < 0);
    return withBalance;
  }, [withBalance, filterType]);

  // Reverse for display (newest first) — but running balance was calculated in chronological order
  const displayData = useMemo(() => [...filtered].reverse(), [filtered]);

  const counts = useMemo(() => ({
    all: withBalance.length,
    profit: withBalance.filter(r => (r.trade.profit + r.trade.commission + r.trade.swap) > 0).length,
    loss: withBalance.filter(r => (r.trade.profit + r.trade.commission + r.trade.swap) < 0).length,
  }), [withBalance]);

  const columns: Column<{ trade: LiveTrade; balance: number }>[] = [
    {
      key: 'close_time', label: 'Close Time',
      render: (row) => <span className="text-text-muted text-xs">{formatDate(row.trade.close_time)}</span>,
      sortable: true, sortValue: (row) => row.trade.close_time,
    },
    {
      key: 'symbol', label: 'Symbol',
      render: (row) => <span className="text-text-primary font-medium font-mono">{row.trade.symbol}</span>,
      sortable: true, sortValue: (row) => row.trade.symbol,
    },
    {
      key: 'type', label: 'Type',
      render: (row) => <StatusBadge label={row.trade.type.toUpperCase()} variant={row.trade.type} />,
      sortable: true, sortValue: (row) => row.trade.type,
    },
    {
      key: 'volume', label: 'Volume', align: 'right',
      render: (row) => <span className="text-text-secondary">{row.trade.volume.toFixed(2)}</span>,
      sortable: true, sortValue: (row) => row.trade.volume,
    },
    {
      key: 'open_price', label: 'Open Price', align: 'right',
      render: (row) => <span className="text-text-secondary">{row.trade.open_price.toFixed(5)}</span>,
    },
    {
      key: 'close_price', label: 'Close Price', align: 'right',
      render: (row) => <span className="text-text-secondary">{row.trade.close_price.toFixed(5)}</span>,
    },
    {
      key: 'profit', label: 'Profit', align: 'right',
      render: (row) => {
        const net = row.trade.profit + row.trade.commission + row.trade.swap;
        return <span className={`font-semibold ${net >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(net)}</span>;
      },
      sortable: true, sortValue: (row) => row.trade.profit + row.trade.commission + row.trade.swap,
    },
    {
      key: 'balance', label: 'Balance', align: 'right',
      render: (row) => <span className="text-text-primary font-mono">{formatCurrency(row.balance)}</span>,
      sortable: true, sortValue: (row) => row.balance,
    },
  ];

  if (trades.length === 0) {
    return <div className="py-16 text-center text-text-muted text-sm">No trades yet</div>;
  }

  return (
    <div className="space-y-0 pt-6">
      {/* Header */}
      <div className="bg-bg-secondary border border-border border-b-0 rounded-t-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(['all', 'profit', 'loss'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 text-xs uppercase font-medium transition-colors ${
                  filterType === type
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <span className="text-xs text-text-muted font-mono">{counts[filterType]} trades</span>
        </div>
        <div className="bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-center">
          <p className="text-2xl font-bold text-text-primary font-mono">{counts.all}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Trade Count</p>
        </div>
      </div>

      {/* Table */}
      <div className="[&>div]:rounded-t-none [&>div]:border-t-0">
        <DataTable
          columns={columns}
          data={displayData}
          sortable={true}
          pagination={true}
          pageSize={25}
          emptyMessage="No trades match this filter"
          rowKey={(row) => String(row.trade.ticket)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/components/live/TradesTab.tsx
git commit -m "feat: add TradesTab with filters, pagination, and running balance"
```

---

### Task 6: Create CalendarTab Component

**Files:**
- Create: `app/components/live/CalendarTab.tsx`

- [ ] **Step 1: Create `app/components/live/CalendarTab.tsx`**

```typescript
'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { LiveTrade } from '../../lib/live-types';
import { groupByDay, calculateWinStreaks, DailyPnl } from '../../lib/trade-stats';

interface CalendarTabProps {
  trades: LiveTrade[];
  balance: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarTab({ trades, balance }: CalendarTabProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const dailyData = useMemo(() => groupByDay(trades), [trades]);
  const streaks = useMemo(() => calculateWinStreaks(trades), [trades]);

  const startingCapital = useMemo(() => {
    const totalPnl = trades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    return balance - totalPnl;
  }, [trades, balance]);

  // Build lookup map for this month
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const dayMap = useMemo(() => {
    const map = new Map<number, DailyPnl>();
    for (const d of dailyData) {
      if (d.date.startsWith(monthKey)) {
        const day = parseInt(d.date.slice(8, 10), 10);
        map.set(day, d);
      }
    }
    return map;
  }, [dailyData, monthKey]);

  // Month summary
  const monthSummary = useMemo(() => {
    let pnl = 0, tradeCt = 0, wins = 0;
    dayMap.forEach(d => { pnl += d.pnl; tradeCt += d.trades; wins += d.wins; });
    const pct = startingCapital > 0 ? (pnl / startingCapital) * 100 : 0;
    return { trades: tradeCt, wins, pnl, pct };
  }, [dayMap, startingCapital]);

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  // Weekly totals
  const weeklyTotals = weeks.map(w => {
    let pnl = 0;
    w.forEach(d => { if (d) { const dd = dayMap.get(d); if (dd) pnl += dd.pnl; } });
    const pct = startingCapital > 0 ? (pnl / startingCapital) * 100 : 0;
    return { pnl, pct };
  });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  if (trades.length === 0) {
    return <div className="py-16 text-center text-text-muted text-sm">No trades yet</div>;
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-semibold text-text-primary min-w-[160px] text-center">
              {MONTH_NAMES[month]} {year}
            </h3>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-text-muted">Trades <span className="text-text-primary font-semibold">{monthSummary.trades}</span></span>
            <span className="text-text-muted">Wins <span className="text-text-primary font-semibold">{monthSummary.wins}</span></span>
            <span className="text-text-muted">P/L <span className={monthSummary.pnl >= 0 ? 'text-profit font-semibold' : 'text-loss font-semibold'}>{formatCurrency(monthSummary.pnl)}</span></span>
            <span className="text-text-muted">PCT <span className={monthSummary.pct >= 0 ? 'text-profit font-semibold' : 'text-loss font-semibold'}>{monthSummary.pct >= 0 ? '+' : ''}{monthSummary.pct.toFixed(2)}%</span></span>
          </div>
        </div>

        {/* Calendar grid */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {DAY_NAMES.map(d => (
                <th key={d} className="text-[10px] text-text-muted uppercase tracking-wider font-medium py-2 text-center">{d}</th>
              ))}
              <th className="text-[10px] text-text-muted uppercase tracking-wider font-medium py-2 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((day, di) => {
                  if (day === null) return <td key={di} className="border border-border/50 p-2 h-16" />;
                  const data = dayMap.get(day);
                  const pct = data && startingCapital > 0 ? (data.pnl / startingCapital) * 100 : 0;
                  return (
                    <td
                      key={di}
                      className={`border border-border/50 p-2 h-16 align-top text-right ${
                        data ? (data.pnl > 0 ? 'bg-profit/5' : data.pnl < 0 ? 'bg-loss/5' : '') : ''
                      }`}
                    >
                      <div className="text-[10px] text-text-muted mb-1">{day}</div>
                      {data && (
                        <>
                          <div className={`text-xs font-semibold font-mono ${data.pnl > 0 ? 'text-profit' : 'text-loss'}`}>
                            {data.pnl > 0 ? '+' : ''}{formatCurrency(data.pnl)}
                          </div>
                          <div className={`text-[10px] font-mono ${pct > 0 ? 'text-profit' : 'text-loss'}`}>
                            {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                          </div>
                        </>
                      )}
                    </td>
                  );
                })}
                <td className={`border border-border/50 p-2 h-16 align-middle text-right ${
                  weeklyTotals[wi].pnl > 0 ? 'bg-profit/5' : weeklyTotals[wi].pnl < 0 ? 'bg-loss/5' : ''
                }`}>
                  {weeklyTotals[wi].pnl !== 0 && (
                    <>
                      <div className={`text-xs font-semibold font-mono ${weeklyTotals[wi].pnl > 0 ? 'text-profit' : 'text-loss'}`}>
                        {weeklyTotals[wi].pnl > 0 ? '+' : ''}{formatCurrency(weeklyTotals[wi].pnl)}
                      </div>
                      <div className={`text-[10px] font-mono ${weeklyTotals[wi].pct > 0 ? 'text-profit' : 'text-loss'}`}>
                        {weeklyTotals[wi].pct > 0 ? '+' : ''}{weeklyTotals[wi].pct.toFixed(2)}%
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Win Streaks */}
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px] mb-4">Win Streaks</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Days</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-text-primary">{streaks.currentDays}</span>
              <Flame className="w-5 h-5 text-warning" />
            </div>
            <p className="text-xs text-text-muted mt-1">Max <span className="text-text-primary font-semibold">{streaks.maxDays}</span></p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Trades</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-text-primary">{streaks.currentTrades}</span>
              <Flame className="w-5 h-5 text-warning" />
            </div>
            <p className="text-xs text-text-muted mt-1">Max <span className="text-text-primary font-semibold">{streaks.maxTrades}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/components/live/CalendarTab.tsx
git commit -m "feat: add CalendarTab with monthly view and win streaks"
```

---

### Task 7: Create PerformanceTab Component

**Files:**
- Create: `app/components/live/PerformanceTab.tsx`

- [ ] **Step 1: Create `app/components/live/PerformanceTab.tsx`**

```typescript
'use client';

import { useMemo } from 'react';
import { LiveTrade } from '../../lib/live-types';
import { groupByMonth, MonthlyPnl } from '../../lib/trade-stats';

interface PerformanceTabProps {
  trades: LiveTrade[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PerformanceTab({ trades }: PerformanceTabProps) {
  const monthly = useMemo(() => groupByMonth(trades), [trades]);

  const grid = useMemo(() => {
    const yearMap = new Map<number, (MonthlyPnl | null)[]>();

    for (const m of monthly) {
      if (!yearMap.has(m.year)) {
        yearMap.set(m.year, Array(12).fill(null));
      }
      yearMap.get(m.year)![m.month] = m;
    }

    // Sort years descending
    return Array.from(yearMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, months]) => {
        const total = months.reduce((sum, m) => sum + (m?.pnl ?? 0), 0);
        return { year, months, total };
      });
  }, [monthly]);

  if (trades.length === 0) {
    return <div className="py-16 text-center text-text-muted text-sm">No trades yet</div>;
  }

  return (
    <div className="pt-6">
      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[10px] text-text-muted uppercase tracking-wider font-medium px-3 py-2.5">Year</th>
              {MONTH_LABELS.map(m => (
                <th key={m} className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium px-1.5 py-2.5">{m}</th>
              ))}
              <th className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium px-3 py-2.5">Total</th>
            </tr>
          </thead>
          <tbody>
            {grid.map(({ year, months, total }) => (
              <tr key={year} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2.5 text-sm font-semibold text-text-primary">{year}</td>
                {months.map((m, i) => (
                  <td key={i} className="px-1.5 py-2.5 text-center">
                    {m ? (
                      <span className={`text-xs font-mono font-medium ${m.pnl >= 0 ? 'text-accent' : 'text-loss'}`}>
                        {m.pnl >= 0 ? '+' : ''}{formatCurrency(m.pnl)}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs font-mono font-semibold ${total >= 0 ? 'text-accent' : 'text-loss'}`}>
                    {total >= 0 ? '+' : ''}{formatCurrency(total)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/components/live/PerformanceTab.tsx
git commit -m "feat: add PerformanceTab with yearly/monthly P/L grid"
```

---

### Task 8: Wire Up Live Page with Tabs

**Files:**
- Modify: `app/live/page.tsx`
- Remove: `app/components/live/LiveEquityChart.tsx`
- Remove: `app/components/live/LiveTradesTable.tsx`

- [ ] **Step 1: Replace `app/live/page.tsx` entirely**

```typescript
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useLiveData } from '../hooks/useLiveData';
import LiveAccountPanel from '../components/live/LiveAccountPanel';
import OpenPositionsTable from '../components/live/OpenPositionsTable';
import AccountSelector from '../components/live/AccountSelector';
import LiveTabs, { TabId } from '../components/live/LiveTabs';
import OverviewTab from '../components/live/OverviewTab';
import TradesTab from '../components/live/TradesTab';
import CalendarTab from '../components/live/CalendarTab';
import PerformanceTab from '../components/live/PerformanceTab';

const LS_KEY = 'mt5-last-account';

function getInitialTab(): TabId {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.slice(1);
  if (['overview', 'trades', 'calendar', 'performance'].includes(hash)) return hash as TabId;
  return 'overview';
}

function LivePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);

  useEffect(() => {
    async function resolveAccount() {
      const urlAccount = searchParams.get('account');

      let availableSlugs: string[] = [];
      try {
        const res = await fetch('/api/live/accounts');
        const data = await res.json();
        availableSlugs = (data.accounts ?? []).map((a: { slug: string }) => a.slug);
      } catch {
        // If we can't fetch accounts, accept any ID
      }

      if (urlAccount && (availableSlugs.length === 0 || availableSlugs.includes(urlAccount))) {
        setAccountId(urlAccount);
        localStorage.setItem(LS_KEY, urlAccount);
      } else {
        const stored = localStorage.getItem(LS_KEY);
        if (stored && (availableSlugs.length === 0 || availableSlugs.includes(stored))) {
          setAccountId(stored);
          router.replace(`/live?account=${encodeURIComponent(stored)}`);
        } else if (availableSlugs.length > 0) {
          const firstSlug = availableSlugs[0];
          setAccountId(firstSlug);
          localStorage.setItem(LS_KEY, firstSlug);
          router.replace(`/live?account=${encodeURIComponent(firstSlug)}`);
        }
      }
      setReady(true);
    }

    resolveAccount();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectAccount = useCallback(
    (slug: string) => {
      setAccountId(slug);
      localStorage.setItem(LS_KEY, slug);
      router.replace(`/live?account=${encodeURIComponent(slug)}`);
    },
    [router]
  );

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    window.location.hash = tab;
  }

  const liveData = useLiveData(accountId);

  if (!ready) return null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <AccountSelector selectedId={accountId} onSelect={handleSelectAccount} />
        <Link
          href="/live/settings"
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          title="Account Settings"
        >
          <Settings className="w-4.5 h-4.5" />
        </Link>
      </div>

      <LiveAccountPanel
        status={liveData.status}
        account={liveData.account}
        lastUpdated={liveData.lastUpdated}
        trades={liveData.history}
      />

      {liveData.status === 'online' && (
        <OpenPositionsTable positions={liveData.positions} />
      )}

      <LiveTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === 'overview' && liveData.account && (
        <OverviewTab trades={liveData.history} balance={liveData.account.balance} />
      )}
      {activeTab === 'trades' && liveData.account && (
        <TradesTab trades={liveData.history} balance={liveData.account.balance} />
      )}
      {activeTab === 'calendar' && liveData.account && (
        <CalendarTab trades={liveData.history} balance={liveData.account.balance} />
      )}
      {activeTab === 'performance' && (
        <PerformanceTab trades={liveData.history} />
      )}

      {!liveData.account && liveData.history.length === 0 && activeTab !== 'overview' && (
        <div className="py-16 text-center text-text-muted text-sm">
          Waiting for account data...
        </div>
      )}
    </main>
  );
}

export default function LivePage() {
  return (
    <Suspense>
      <LivePageContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Delete old components**

```bash
git rm app/components/live/LiveEquityChart.tsx
git rm app/components/live/LiveTradesTable.tsx
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire up tabbed live page with all four tabs"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors (pre-existing ones in unrelated files are OK).

- [ ] **Step 3: Rebuild Docker image and deploy**

```bash
docker build -t metatrader-journal:latest .
docker rm -f trading
docker run -d --name trading --network development_lgu-network \
  -e MYSQL_HOST=lgu-mysql \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=DpCH7pisSoTNjOxApMbiDrpQc0obOLU \
  -e MYSQL_DATABASE=db_metatrader_journal \
  metatrader-journal:latest
```

- [ ] **Step 4: Manual end-to-end test**

Open `http://livetrades.local/live` and verify:

1. Account panel and open positions still show above tabs
2. Overview tab: stat cards (net profit, profit factor, etc.) and equity curve
3. Trades tab: filter buttons (All/Profit/Loss), trade count, table with Balance column, pagination at 25 per page
4. Calendar tab: month navigation, daily P/L cells with colors, weekly totals, win streaks
5. Performance tab: year × month grid with color-coded P/L
6. Switching tabs updates URL hash
7. Refreshing page preserves the active tab
8. Switching accounts resets and reloads all data
