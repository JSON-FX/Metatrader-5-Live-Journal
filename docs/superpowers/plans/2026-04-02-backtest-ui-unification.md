# Backtest UI Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify backtest report views to match the live trading tabs UI — calendar streaks, performance grid, and global $/% toggle.

**Architecture:** Extract shared presentation components (StreaksTable, DisplayModeToggle) used by both live and backtest. Add `calculateStreaksFromDeals()` to trade-stats.ts for backtest data. Lift displayMode state to backtest page level. Rewrite backtest performance grid to match live's clean table style.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, lucide-react icons

**Verification:** This project has no test framework. Verify with `npx tsc --noEmit` for type-checking and `npm run dev` for visual confirmation.

---

### Task 1: Create shared StreaksTable component

**Files:**
- Create: `app/components/shared/StreaksTable.tsx`

This is a pure presentation component extracted from the live CalendarTab streaks markup. It renders a card with a title and a 4-row × 2-column table (Current, Longest) showing Winning Days, Losing Days, Winning Trades, Losing Trades.

- [ ] **Step 1: Create `app/components/shared/StreaksTable.tsx`**

```tsx
'use client';

import { Flame } from 'lucide-react';
import { StreakData } from '../../lib/trade-stats';

interface StreaksTableProps {
  title: string;
  streaks: StreakData;
}

export default function StreaksTable({ title, streaks }: StreaksTableProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px] mb-4">
        {title}
      </h3>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2"></th>
            <th className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Current</th>
            <th className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Longest</th>
          </tr>
        </thead>
        <tbody className="text-center">
          <tr className="border-t border-border/50">
            <td className="py-2.5 text-left">
              <span className="text-xs text-text-secondary flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-profit" /> Winning Days</span>
            </td>
            <td className="py-2.5"><span className="text-lg font-bold text-profit font-mono">{streaks.winStreak}</span></td>
            <td className="py-2.5"><span className="text-lg font-bold text-text-primary font-mono">{streaks.maxWinStreak}</span></td>
          </tr>
          <tr className="border-t border-border/50">
            <td className="py-2.5 text-left">
              <span className="text-xs text-text-secondary flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-loss" /> Losing Days</span>
            </td>
            <td className="py-2.5"><span className="text-lg font-bold text-loss font-mono">{streaks.loseStreak}</span></td>
            <td className="py-2.5"><span className="text-lg font-bold text-text-primary font-mono">{streaks.maxLoseStreak}</span></td>
          </tr>
          <tr className="border-t border-border/50">
            <td className="py-2.5 text-left">
              <span className="text-xs text-text-secondary flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-profit" /> Winning Trades</span>
            </td>
            <td className="py-2.5"><span className="text-lg font-bold text-profit font-mono">{streaks.winStreakTrades}</span></td>
            <td className="py-2.5"><span className="text-lg font-bold text-text-primary font-mono">{streaks.maxWinStreakTrades}</span></td>
          </tr>
          <tr className="border-t border-border/50">
            <td className="py-2.5 text-left">
              <span className="text-xs text-text-secondary flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-loss" /> Losing Trades</span>
            </td>
            <td className="py-2.5"><span className="text-lg font-bold text-loss font-mono">{streaks.loseStreakTrades}</span></td>
            <td className="py-2.5"><span className="text-lg font-bold text-text-primary font-mono">{streaks.maxLoseStreakTrades}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to StreaksTable.tsx

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/StreaksTable.tsx
git commit -m "feat: create shared StreaksTable component"
```

---

### Task 2: Wire StreaksTable into live CalendarTab

**Files:**
- Modify: `app/components/live/CalendarTab.tsx:186-276` (replace streaks markup)

Replace the two inline streaks card blocks in CalendarTab with the shared StreaksTable component. The data calculation (`monthStreaks`, `allTimeStreaks`) stays — only the rendering changes.

- [ ] **Step 1: Update CalendarTab imports**

At the top of `app/components/live/CalendarTab.tsx`, add the import:

```tsx
import StreaksTable from '../shared/StreaksTable';
```

The `Flame` import from lucide-react can be removed since it's no longer used directly in this file.

- [ ] **Step 2: Replace the streaks section (lines 186-276)**

Replace the entire `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">` block (the two inline streak cards) with:

```tsx
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StreaksTable title={`${MONTH_NAMES[month]} Streaks`} streaks={monthStreaks} />
        <StreaksTable title="All-Time Streaks" streaks={allTimeStreaks} />
      </div>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/live/CalendarTab.tsx
git commit -m "refactor: use shared StreaksTable in live CalendarTab"
```

---

### Task 3: Add `calculateStreaksFromDeals()` to trade-stats.ts

**Files:**
- Modify: `app/lib/trade-stats.ts` (add new function after `calculateStreaks`)

This function takes `MT5Deal[]` and returns `StreakData`, same shape as `calculateStreaks()`. It has an optional `dateRange` parameter to scope streaks to a selected calendar month.

- [ ] **Step 1: Add the import for MT5Deal at the top of trade-stats.ts**

At the top of `app/lib/trade-stats.ts`, add:

```tsx
import { MT5Deal } from './types';
```

- [ ] **Step 2: Add `calculateStreaksFromDeals` after the existing `calculateStreaks` function (after line 222)**

```tsx
export function calculateStreaksFromDeals(
  deals: MT5Deal[],
  dateRange?: { start: string; end: string }
): StreakData {
  // Filter to closing deals with a symbol
  let closingDeals = deals.filter(d => d.direction === 'out' && d.symbol);

  if (dateRange) {
    closingDeals = closingDeals.filter(d => {
      const date = d.time.split(' ')[0].replace(/[\/\.]/g, '-');
      return date >= dateRange.start && date <= dateRange.end;
    });
  }

  const sorted = [...closingDeals].sort((a, b) => {
    const ta = a.time.replace(/[\/\.]/g, '-');
    const tb = b.time.replace(/[\/\.]/g, '-');
    return ta.localeCompare(tb);
  });

  // Build daily PnL map
  const dailyPnl: Record<string, number> = {};
  for (const deal of sorted) {
    const date = deal.time.split(' ')[0].replace(/[\/\.]/g, '-');
    dailyPnl[date] = (dailyPnl[date] || 0) + deal.profit + (deal.commission || 0) + (deal.swap || 0);
  }
  const sortedDays = Object.keys(dailyPnl).sort();

  // Day streaks (win + lose)
  let winDayStreak = 0, maxWinDayStreak = 0;
  let loseDayStreak = 0, maxLoseDayStreak = 0;
  for (const day of sortedDays) {
    if (dailyPnl[day] > 0) {
      winDayStreak++; loseDayStreak = 0;
      if (winDayStreak > maxWinDayStreak) maxWinDayStreak = winDayStreak;
    } else if (dailyPnl[day] < 0) {
      loseDayStreak++; winDayStreak = 0;
      if (loseDayStreak > maxLoseDayStreak) maxLoseDayStreak = loseDayStreak;
    } else {
      winDayStreak = 0; loseDayStreak = 0;
    }
  }

  // Current day streaks (from end)
  let currentWinDays = 0, currentLoseDays = 0;
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    if (dailyPnl[sortedDays[i]] > 0) { if (currentLoseDays > 0) break; currentWinDays++; }
    else if (dailyPnl[sortedDays[i]] < 0) { if (currentWinDays > 0) break; currentLoseDays++; }
    else break;
  }

  // Trade streaks (win + lose)
  let winTradeStreak = 0, maxWinTradeStreak = 0;
  let loseTradeStreak = 0, maxLoseTradeStreak = 0;
  for (const deal of sorted) {
    const net = deal.profit + (deal.commission || 0) + (deal.swap || 0);
    if (net > 0) {
      winTradeStreak++; loseTradeStreak = 0;
      if (winTradeStreak > maxWinTradeStreak) maxWinTradeStreak = winTradeStreak;
    } else {
      loseTradeStreak++; winTradeStreak = 0;
      if (loseTradeStreak > maxLoseTradeStreak) maxLoseTradeStreak = loseTradeStreak;
    }
  }

  // Current trade streaks (from end)
  let currentWinTrades = 0, currentLoseTrades = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const net = sorted[i].profit + (sorted[i].commission || 0) + (sorted[i].swap || 0);
    if (net > 0) { if (currentLoseTrades > 0) break; currentWinTrades++; }
    else { if (currentWinTrades > 0) break; currentLoseTrades++; }
  }

  return {
    winStreak: currentWinDays,
    maxWinStreak: maxWinDayStreak,
    loseStreak: currentLoseDays,
    maxLoseStreak: maxLoseDayStreak,
    winStreakTrades: currentWinTrades,
    maxWinStreakTrades: maxWinTradeStreak,
    loseStreakTrades: currentLoseTrades,
    maxLoseStreakTrades: maxLoseTradeStreak,
  };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/lib/trade-stats.ts
git commit -m "feat: add calculateStreaksFromDeals for backtest streak calculation"
```

---

### Task 4: Move DisplayModeToggle to shared

**Files:**
- Create: `app/components/shared/DisplayModeToggle.tsx` (copy from live)
- Modify: `app/live/page.tsx:14` (update import path)
- Delete: `app/components/live/DisplayModeToggle.tsx`

- [ ] **Step 1: Create `app/components/shared/DisplayModeToggle.tsx`**

Copy the exact contents of `app/components/live/DisplayModeToggle.tsx`:

```tsx
'use client';

import { DisplayMode } from '../../lib/live-types';

interface DisplayModeToggleProps {
  mode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}

const MODES: { id: DisplayMode; label: string }[] = [
  { id: 'money', label: '$' },
  { id: 'percent', label: '%' },
];

export default function DisplayModeToggle({ mode, onChange }: DisplayModeToggleProps) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-border">
      {MODES.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
            mode === m.id
              ? 'bg-bg-tertiary text-text-primary'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update import in `app/live/page.tsx`**

Change line 14 from:
```tsx
import DisplayModeToggle from '../components/live/DisplayModeToggle';
```
to:
```tsx
import DisplayModeToggle from '../components/shared/DisplayModeToggle';
```

- [ ] **Step 3: Delete `app/components/live/DisplayModeToggle.tsx`**

```bash
rm app/components/live/DisplayModeToggle.tsx
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors. Live page still works with the new import path.

- [ ] **Step 5: Commit**

```bash
git add app/components/shared/DisplayModeToggle.tsx app/live/page.tsx
git rm app/components/live/DisplayModeToggle.tsx
git commit -m "refactor: move DisplayModeToggle to shared components"
```

---

### Task 5: Add rightSlot to ReportTabs and wire displayMode state

**Files:**
- Modify: `app/components/backtest/ReportTabs.tsx` (add rightSlot prop)
- Modify: `app/backtests/[id]/page.tsx` (add displayMode state, wire toggle + props)

- [ ] **Step 1: Update `app/components/backtest/ReportTabs.tsx`**

Replace the entire file with:

```tsx
'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'trades', label: 'Trades' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'performance', label: 'Performance' },
] as const;

type TabKey = typeof TABS[number]['key'];

interface ReportTabsProps {
  children: Record<TabKey, React.ReactNode>;
  rightSlot?: React.ReactNode;
}

export default function ReportTabs({ children, rightSlot }: ReportTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get('tab') as TabKey) || 'overview';

  const setTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border mb-6">
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-medium uppercase tracking-[1px] transition-colors border-b-2 -mb-[1px] ${
                activeTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {rightSlot && <div className="pb-1">{rightSlot}</div>}
      </div>
      {children[activeTab]}
    </div>
  );
}
```

- [ ] **Step 2: Update `app/backtests/[id]/page.tsx`**

Replace the entire file with:

```tsx
'use client';

import { use, useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { loadReports } from '../../lib/storage';
import { MT5Report } from '../../lib/types';
import { DisplayMode } from '../../lib/live-types';
import Header from '../../components/shared/Header';
import ReportTabs from '../../components/backtest/ReportTabs';
import ReportOverview from '../../components/backtest/ReportOverview';
import ReportTrades from '../../components/backtest/ReportTrades';
import ReportCalendar from '../../components/backtest/ReportCalendar';
import ReportPerformance from '../../components/backtest/ReportPerformance';
import DisplayModeToggle from '../../components/shared/DisplayModeToggle';

function getSymbol(report: MT5Report): string {
  return report.settings.symbol.replace('_tickstory', '').toUpperCase();
}

function ReportContent({ id }: { id: string }) {
  const router = useRouter();
  const [report, setReport] = useState<MT5Report | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('money');

  useEffect(() => {
    const reports = loadReports();
    const found = reports.find(r => r.id === id);
    if (!found) {
      router.replace('/backtests');
      return;
    }
    setReport(found);
  }, [id, router]);

  if (!report) return null;

  const title = `${getSymbol(report)} — ${report.name}`;

  return (
    <>
      <Header title={title} backHref="/backtests" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ReportTabs rightSlot={<DisplayModeToggle mode={displayMode} onChange={setDisplayMode} />}>
          {{
            overview: <ReportOverview report={report} displayMode={displayMode} />,
            trades: <ReportTrades report={report} />,
            calendar: <ReportCalendar report={report} displayMode={displayMode} />,
            performance: <ReportPerformance report={report} displayMode={displayMode} />,
          }}
        </ReportTabs>
      </main>
    </>
  );
}

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <Suspense>
      <ReportContent id={id} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: Errors about ReportOverview, ReportCalendar, and ReportPerformance not accepting `displayMode` prop yet. That's expected — we fix those in the next tasks.

- [ ] **Step 4: Commit**

```bash
git add app/components/backtest/ReportTabs.tsx app/backtests/[id]/page.tsx
git commit -m "feat: add displayMode state and rightSlot toggle to backtest tabs"
```

---

### Task 6: Update ReportCalendar — streaks + displayMode + formatValue

**Files:**
- Modify: `app/components/backtest/ReportCalendar.tsx` (full rewrite)

This is the biggest change. We:
1. Accept `displayMode` prop
2. Replace local `formatCurrency` with `formatValue` from trade-stats.ts
3. Replace the old "Win Streaks" card with two `<StreaksTable>` cards (month + all-time)
4. Use `calculateStreaksFromDeals` for streak data
5. Match the live CalendarTab's table-based calendar layout (instead of div-based grid)

- [ ] **Step 1: Replace `app/components/backtest/ReportCalendar.tsx` entirely**

```tsx
'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MT5Report } from '../../lib/types';
import { DisplayMode } from '../../lib/live-types';
import { StreakData, calculateStreaksFromDeals, formatValue } from '../../lib/trade-stats';
import StreaksTable from '../shared/StreaksTable';

interface ReportCalendarProps {
  report: MT5Report;
  displayMode: DisplayMode;
}

interface DayData {
  profit: number;
  percent: number;
  trades: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ReportCalendar({ report, displayMode }: ReportCalendarProps) {
  const { deals, settings } = report;
  const initialDeposit = settings.initialDeposit || 1000;

  const [currentDate, setCurrentDate] = useState(() => {
    const closingDeals = deals.filter(d => d.direction === 'out' && d.symbol);
    if (closingDeals.length > 0) {
      const lastDeal = [...closingDeals].sort((a, b) => {
        const ta = a.time.replace(/[\/\.]/g, '-');
        const tb = b.time.replace(/[\/\.]/g, '-');
        return new Date(tb).getTime() - new Date(ta).getTime();
      })[0];
      const normalized = lastDeal.time.replace(/[\/\.]/g, '-');
      return new Date(normalized);
    }
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { dailyData, weeklyTotals, monthStats } = useMemo(() => {
    const allDeals = deals.filter(d => d.symbol);
    const daily: Record<string, DayData> = {};

    const sortedDeals = [...allDeals].sort((a, b) => {
      const ta = a.time.replace(/[\/\.]/g, '-');
      const tb = b.time.replace(/[\/\.]/g, '-');
      return new Date(ta).getTime() - new Date(tb).getTime();
    });

    sortedDeals.forEach(deal => {
      const rawDate = deal.time.split(' ')[0];
      const date = rawDate.replace(/[\/\.]/g, '-');
      if (!daily[date]) daily[date] = { profit: 0, percent: 0, trades: 0 };
      daily[date].profit += deal.profit + (deal.commission || 0) + (deal.swap || 0);
      if (deal.direction === 'out') daily[date].trades += 1;
    });

    const sortedDates = Object.keys(daily).sort();
    let balance = initialDeposit;
    sortedDates.forEach(date => {
      daily[date].percent = (daily[date].profit / balance) * 100;
      balance += daily[date].profit;
    });

    let monthTrades = 0;
    let monthWins = 0;
    let monthProfit = 0;

    Object.keys(daily).forEach(date => {
      const d = new Date(date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        monthTrades += daily[date].trades;
        monthProfit += daily[date].profit;
        if (daily[date].profit > 0) monthWins += daily[date].trades;
      }
    });

    const monthPercent = initialDeposit > 0 ? (monthProfit / initialDeposit) * 100 : 0;

    // Weekly totals
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const numWeeks = Math.ceil((startPadding + totalDays) / 7);

    const weekly: { profit: number; percent: number }[] = [];
    for (let week = 0; week < numWeeks; week++) {
      let weekProfit = 0;
      for (let day = 0; day < 7; day++) {
        const cellIndex = week * 7 + day;
        const dayNum = cellIndex - startPadding + 1;
        if (dayNum >= 1 && dayNum <= totalDays) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          if (daily[dateStr]) weekProfit += daily[dateStr].profit;
        }
      }
      const weekPercent = initialDeposit > 0 ? (weekProfit / initialDeposit) * 100 : 0;
      weekly.push({ profit: weekProfit, percent: weekPercent });
    }

    return {
      dailyData: daily,
      weeklyTotals: weekly,
      monthStats: { trades: monthTrades, wins: monthWins, profit: monthProfit, percent: monthPercent },
    };
  }, [deals, settings, currentDate, year, month, initialDeposit]);

  // Streaks: month-scoped (to selected calendar month) and all-time
  const monthDateRange = useMemo(() => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [year, month]);

  const monthStreaks = useMemo(() => calculateStreaksFromDeals(deals, monthDateRange), [deals, monthDateRange]);
  const allTimeStreaks = useMemo(() => calculateStreaksFromDeals(deals), [deals]);

  const navigateMonth = (delta: number) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  };

  // Build calendar weeks
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDayOfWeek).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigateMonth(-1)} className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-semibold text-text-primary min-w-[160px] text-center">
              {MONTH_NAMES[month]} {year}
            </h3>
            <button onClick={() => navigateMonth(1)} className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-text-muted">Trades <span className="text-text-primary font-semibold">{monthStats.trades}</span></span>
            <span className="text-text-muted">Wins <span className="text-text-primary font-semibold">{monthStats.wins}</span></span>
            <span className="text-text-muted">P/L <span className={monthStats.profit >= 0 ? 'text-profit font-semibold' : 'text-loss font-semibold'}>{formatValue(monthStats.profit, displayMode, { startingCapital: initialDeposit })}</span></span>
            <span className="text-text-muted">PCT <span className={monthStats.percent >= 0 ? 'text-profit font-semibold' : 'text-loss font-semibold'}>{monthStats.percent >= 0 ? '+' : ''}{monthStats.percent.toFixed(2)}%</span></span>
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
            {weeks.map((w, wi) => (
              <tr key={wi}>
                {w.map((day, di) => {
                  if (day === null) return <td key={di} className="border border-border/50 p-2 h-16" />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const data = dailyData[dateStr];
                  const pct = data && initialDeposit > 0 ? (data.profit / initialDeposit) * 100 : 0;
                  return (
                    <td
                      key={di}
                      className={`border border-border/50 p-2 h-16 align-top text-right ${
                        data ? (data.profit > 0 ? 'bg-profit/5' : data.profit < 0 ? 'bg-loss/5' : '') : ''
                      }`}
                    >
                      <div className="text-[10px] text-text-muted mb-1">{day}</div>
                      {data && data.trades > 0 && (
                        <>
                          <div className={`text-xs font-semibold font-mono ${data.profit > 0 ? 'text-profit' : 'text-loss'}`}>
                            {formatValue(data.profit, displayMode, { startingCapital: initialDeposit })}
                          </div>
                          {displayMode !== 'percent' && (
                            <div className={`text-[10px] font-mono ${pct > 0 ? 'text-profit' : 'text-loss'}`}>
                              {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
                <td className={`border border-border/50 p-2 h-16 align-middle text-right ${
                  weeklyTotals[wi].profit > 0 ? 'bg-profit/5' : weeklyTotals[wi].profit < 0 ? 'bg-loss/5' : ''
                }`}>
                  {weeklyTotals[wi].profit !== 0 && (
                    <>
                      <div className={`text-xs font-semibold font-mono ${weeklyTotals[wi].profit > 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatValue(weeklyTotals[wi].profit, displayMode, { startingCapital: initialDeposit })}
                      </div>
                      {displayMode !== 'percent' && (
                        <div className={`text-[10px] font-mono ${weeklyTotals[wi].percent > 0 ? 'text-profit' : 'text-loss'}`}>
                          {weeklyTotals[wi].percent > 0 ? '+' : ''}{weeklyTotals[wi].percent.toFixed(2)}%
                        </div>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Streaks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StreaksTable title={`${MONTH_NAMES[month]} Streaks`} streaks={monthStreaks} />
        <StreaksTable title="All-Time Streaks" streaks={allTimeStreaks} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: May still have errors from ReportOverview/ReportPerformance not accepting displayMode yet. ReportCalendar itself should be clean.

- [ ] **Step 3: Commit**

```bash
git add app/components/backtest/ReportCalendar.tsx
git commit -m "feat: unify backtest calendar with live — table layout, streaks, displayMode"
```

---

### Task 7: Update ReportPerformance — clean table + displayMode prop

**Files:**
- Modify: `app/components/backtest/ReportPerformance.tsx` (rewrite grid, accept displayMode prop)

Remove local `displayMode` state, local `formatValue`, and the colored box grid. Replace with a clean table matching live's `PerformanceTab`. Keep the Risk Breakdown section.

- [ ] **Step 1: Replace `app/components/backtest/ReportPerformance.tsx` entirely**

```tsx
'use client';

import { useMemo } from 'react';
import { MT5Report } from '../../lib/types';
import { DisplayMode } from '../../lib/live-types';
import { formatValue } from '../../lib/trade-stats';
import StatCard from '../shared/StatCard';

interface ReportPerformanceProps {
  report: MT5Report;
  displayMode: DisplayMode;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ReportPerformance({ report, displayMode }: ReportPerformanceProps) {
  const { deals, settings, results } = report;
  const initialDeposit = settings.initialDeposit || 1000;

  const grid = useMemo(() => {
    const allDeals = deals.filter(d => d.symbol);
    const monthMap = new Map<string, number>();

    allDeals.forEach(deal => {
      const normalizedTime = deal.time.replace(/[\/\.]/g, '-');
      const date = new Date(normalizedTime);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const pnl = deal.profit + (deal.commission || 0) + (deal.swap || 0);
      monthMap.set(key, (monthMap.get(key) || 0) + pnl);
    });

    const yearSet = new Set<number>();
    monthMap.forEach((_, key) => yearSet.add(parseInt(key.split('-')[0])));
    const years = Array.from(yearSet).sort((a, b) => b - a);

    return years.map(year => {
      const months: (number | null)[] = Array(12).fill(null);
      for (let m = 0; m < 12; m++) {
        const val = monthMap.get(`${year}-${m}`);
        if (val !== undefined) months[m] = val;
      }
      const total = months.reduce((sum, m) => sum + (m ?? 0), 0);
      return { year, months, total };
    });
  }, [deals]);

  // Risk calculations
  const netProfitPercent = (results.totalNetProfit / initialDeposit) * 100;
  const highestDrawdownPercent = Math.max(
    results.balanceDrawdownMaximalPercent,
    results.equityDrawdownMaximalPercent
  );
  const riskValue = settings.inputs?.RiskValue as number || 0;
  const riskMode = settings.inputs?.RiskMode as number;
  const riskPerTrade = riskMode === 0 ? riskValue : 0;
  const isEstimatedRisk = settings.inputs?._isEstimated as boolean || false;
  const totalRiskExposure = report.isMerged && report.combinedRiskExposure !== undefined
    ? report.combinedRiskExposure
    : riskPerTrade;
  const riskAdjustedReturn = highestDrawdownPercent > 0
    ? (netProfitPercent / highestDrawdownPercent).toFixed(2)
    : 'N/A';

  const hasRiskData = riskPerTrade > 0 || (report.isMerged && report.combinedRiskExposure !== undefined);

  return (
    <div className="space-y-6 pt-6">
      {/* Yearly grid — clean table matching live PerformanceTab */}
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
                {months.map((pnl, i) => (
                  <td key={i} className="px-1.5 py-2.5 text-center">
                    {pnl !== null ? (
                      <span className={`text-xs font-mono font-medium ${pnl >= 0 ? 'text-accent' : 'text-loss'}`}>
                        {formatValue(pnl, displayMode, { startingCapital: initialDeposit })}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs font-mono font-semibold ${total >= 0 ? 'text-accent' : 'text-loss'}`}>
                    {formatValue(total, displayMode, { startingCapital: initialDeposit })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Risk breakdown */}
      {hasRiskData && (
        <div>
          <p className="text-[11px] text-text-muted uppercase tracking-[1px] mb-3">Risk Breakdown</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Risk per Trade"
              value={riskPerTrade > 0 ? `${riskPerTrade}%` : 'N/A'}
              secondaryValue={
                riskPerTrade > 0
                  ? isEstimatedRisk
                    ? `~${formatCurrency(initialDeposit * riskPerTrade / 100)} avg`
                    : `${formatCurrency(initialDeposit * riskPerTrade / 100)} per trade`
                  : 'Fixed lot mode'
              }
              variant="accent"
            />
            <StatCard
              label="Total Exposure"
              value={totalRiskExposure > 0 ? `${totalRiskExposure}%` : 'N/A'}
              secondaryValue={
                report.isMerged
                  ? report.sourceRiskValues?.filter(r => r > 0).map(r => `${r}%`).join(' + ') || 'N/A'
                  : isEstimatedRisk ? 'Estimated' : 'Single setup'
              }
              variant={totalRiskExposure > 10 ? 'warning' : 'default'}
            />
            <StatCard
              label="Highest Drawdown"
              value={`-${highestDrawdownPercent.toFixed(2)}%`}
              secondaryValue={
                report.isMerged && report.sourceDrawdowns
                  ? `Worst: ${report.sourceDrawdowns.map(d => `${d.toFixed(1)}%`).join(', ')}`
                  : formatCurrency(-Math.max(results.balanceDrawdownMaximal, results.equityDrawdownMaximal))
              }
              variant="loss"
            />
            {report.isMerged && report.worstCaseDrawdown ? (
              <StatCard
                label="Worst Case DD"
                value={`-${report.worstCaseDrawdown.toFixed(2)}%`}
                secondaryValue="If all DDs hit simultaneously"
                variant="loss"
              />
            ) : (
              <StatCard
                label="Risk-Adjusted Return"
                value={riskAdjustedReturn}
                secondaryValue="Return / Max DD"
                variant={parseFloat(riskAdjustedReturn) >= 1 ? 'profit' : 'default'}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: May still have error from ReportOverview not accepting displayMode. ReportPerformance should be clean.

- [ ] **Step 3: Commit**

```bash
git add app/components/backtest/ReportPerformance.tsx
git commit -m "feat: unify backtest performance grid with live — clean table, displayMode prop"
```

---

### Task 8: Update ReportOverview to accept displayMode

**Files:**
- Modify: `app/components/backtest/ReportOverview.tsx` (add displayMode prop, use formatValue for stat values)

ReportOverview currently uses a local `formatCurrency` for all values. We add the `displayMode` prop so the page compiles, and use `formatValue` for the key monetary stat cards (Net Profit, Expected Payoff, Gross Profit, Gross Loss, Avg Win, Avg Loss).

- [ ] **Step 1: Update the interface and imports in `app/components/backtest/ReportOverview.tsx`**

Add the import for DisplayMode and formatValue at the top:

```tsx
import { DisplayMode } from '../../lib/live-types';
import { formatValue } from '../../lib/trade-stats';
```

Update the interface:

```tsx
interface ReportOverviewProps {
  report: MT5Report;
  displayMode: DisplayMode;
}
```

Update the component signature:

```tsx
export default function ReportOverview({ report, displayMode }: ReportOverviewProps) {
```

- [ ] **Step 2: Add a format helper inside the component**

After line `const netProfitPercent = ...` (line 26), add:

```tsx
  const fmt = (val: number) => formatValue(val, displayMode, { startingCapital: settings.initialDeposit });
```

- [ ] **Step 3: Update stat card values to use displayMode**

Replace the 6 StatCard value props that show dollar amounts:

- Net Profit: change `value={formatCurrency(results.totalNetProfit)}` to `value={fmt(results.totalNetProfit)}`
- Expected Payoff: change `value={formatCurrency(results.expectedPayoff)}` to `value={fmt(results.expectedPayoff)}`
- Gross Profit: change `value={formatCurrency(results.grossProfit)}` to `value={fmt(results.grossProfit)}`
- Gross Loss: change `value={formatCurrency(results.grossLoss)}` to `value={fmt(results.grossLoss)}`
- Avg Win: change `value={formatCurrency(tradeStats.averageProfitTrade)}` to `value={fmt(tradeStats.averageProfitTrade)}`
- Avg Loss: change `value={formatCurrency(tradeStats.averageLossTrade)}` to `value={fmt(tradeStats.averageLossTrade)}`

Keep `formatCurrency` for non-togglable values like Initial Deposit and Max Drawdown secondary value.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors. All backtest tabs now accept their required props.

- [ ] **Step 5: Commit**

```bash
git add app/components/backtest/ReportOverview.tsx
git commit -m "feat: add displayMode support to backtest ReportOverview"
```

---

### Task 9: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 2: Start dev server and visually verify**

Run: `npm run dev`

Check these pages:
1. `/live` — verify live page still works, streaks display correctly, $/% toggle works across all tabs
2. `/backtests/[any-report-id]` — verify:
   - $/% toggle appears in tab bar (right-aligned next to tabs)
   - Calendar tab shows table-based calendar (not div grid), $/% toggle changes values
   - Calendar streaks show month + all-time side by side (4 rows each: Winning Days, Losing Days, Winning Trades, Losing Trades)
   - Month streaks update when navigating calendar months
   - Performance tab shows clean table (no colored boxes, no trade counts), $/% toggle works
   - Overview tab stat values respond to $/% toggle
   - Risk Breakdown section still appears in Performance tab when applicable

- [ ] **Step 3: Commit any fixes if needed**

If visual verification reveals issues, fix them and commit.
