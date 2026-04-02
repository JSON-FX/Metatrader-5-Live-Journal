# Live Trading Tabs — Design Spec

## Overview

Restructure the live trading page (`/live`) from a single-view dashboard into a tabbed interface matching the backtest report view. Four tabs — Overview, Trades, Calendar, Performance — provide comprehensive analytics for live trading accounts.

## Motivation

The backtest section already has rich analytics (stats, trade list, calendar, monthly performance grid). The live trading page currently shows only basic stats and a trade history table. Traders need the same analytical depth for live accounts.

## Page Layout

```
┌─────────────────────────────────────────┐
│ Account Selector  ⚙️                    │
├─────────────────────────────────────────┤
│ Live Account Panel (status, balance,    │
│ equity, floating P/L, drawdown)         │
├─────────────────────────────────────────┤
│ Open Positions Table (always visible)   │
├─────────────────────────────────────────┤
│ [Overview] [Trades] [Calendar] [Perf]   │
│─────────────────────────────────────────│
│         Tab Content Area                │
└─────────────────────────────────────────┘
```

**Above the tabs (always visible):**
- Account selector dropdown + settings gear icon (unchanged)
- `LiveAccountPanel` with connection status badge, balance, equity, floating P/L, drawdown (unchanged)
- Open positions table — shown when status is online, above the tab bar

**Tab bar:**
- Four tabs: Overview, Trades, Calendar, Performance
- Active tab stored in URL hash (`/live?account=live#trades`) for persistence on refresh
- Default tab: Overview

**Data strategy:**
- History fetched once on page load with `days=3650` (10 years), shared across all tabs
- 5-second polling continues for account info, positions, and health
- History refreshed on a longer interval (60 seconds) since it's a larger payload
- All tab calculations done client-side from the shared history dataset

## Tab 1: Overview

**Row 1 — Primary stat cards:**

| Stat | Calculation |
|------|------------|
| Net Profit | Sum of all trades (profit + commission + swap) |
| Profit Factor | Gross profit / |Gross loss| |
| Total Trades | Count of closed trades |
| Win Rate | Profitable trades / Total trades × 100 |
| Expected Payoff | Net profit / Total trades |

**Row 2 — Secondary stat cards:**

| Stat | Calculation |
|------|------------|
| Gross Profit | Sum of profitable trades |
| Gross Loss | Sum of losing trades |
| Max Drawdown | Largest peak-to-trough decline in equity curve ($ and %) |
| Commission + Swap | Sum of all commission + swap values |
| Best / Worst Trade | Highest and lowest individual trade profit |

**Below stats:** Full-width equity curve chart showing balance progression over time, calculated from trade history and starting capital.

## Tab 2: Trades

**Header area:**
- Filter buttons: All | Profit | Loss — active filter highlighted
- Trade count widget on the right showing total count for the active filter

**Table columns:**

| Column | Content |
|--------|---------|
| Close Time | Date/time of trade close |
| Symbol | Trading instrument |
| Type | BUY/SELL badge |
| Volume | Lot size |
| Open Price | Entry price |
| Close Price | Exit price |
| Profit | P/L for the trade (color-coded) |
| Balance | Running balance after this trade |

**Pagination:** 25 trades per page, Prev/Next buttons at bottom.

**Default sort:** Close time descending (newest first).

**Sortable columns:** Close time, symbol, type, volume, profit, balance.

## Tab 3: Calendar

**Month navigation:** Left/right arrows with month/year label (e.g., "December 2025").

**Month summary header:** Trades count, Wins count, total P/L, percentage return for the visible month.

**Calendar grid:**
- 7 columns (Sun–Sat), rows for each week of the month
- Each day cell shows:
  - Dollar P/L (green text for profit, red for loss)
  - Percentage return for that day
  - Empty for days with no trades
- Background tint: green for profitable days, red for losing days
- Weekly totals in a right-side column showing week P/L and percentage

**Win Streaks section** below the calendar:
- Current win streak (consecutive profitable days), with max streak shown
- Current win streak (consecutive profitable trades), with max streak shown

**Data grouping:** Trades grouped by close date to calculate daily P/L.

## Tab 4: Performance

**Monthly/yearly performance grid:**
- One row per year that has trades
- 12 columns (Jan–Dec) plus a Total column
- Cell values: P/L amount for that month, color-coded (blue/positive, red/negative)
- Years sorted descending (most recent at top)

**Data grouping:** Trades grouped by year-month of close date.

## Data Flow

```
useLiveData hook
  ├── 5-second poll: health, account, positions
  └── 60-second poll: history (days=3650)
        │
        └── Shared history array
              ├── Overview tab (calculates stats + equity curve)
              ├── Trades tab (displays + filters + paginates)
              ├── Calendar tab (groups by day)
              └── Performance tab (groups by month/year)
```

The `useLiveData` hook is updated to support two polling intervals: fast (5s) for real-time data and slow (60s) for trade history.

## Files to Create

| File | Purpose |
|------|---------|
| `app/components/live/LiveTabs.tsx` | Tab bar component |
| `app/components/live/OverviewTab.tsx` | Overview tab with stat cards + equity curve |
| `app/components/live/TradesTab.tsx` | Trades tab with filters, table, pagination |
| `app/components/live/CalendarTab.tsx` | Calendar tab with monthly view + win streaks |
| `app/components/live/PerformanceTab.tsx` | Performance grid (year × month) |
| `app/lib/trade-stats.ts` | Pure functions: calculate net profit, profit factor, win rate, drawdown, daily/monthly groupings, win streaks |

## Files to Modify

| File | Change |
|------|--------|
| `app/live/page.tsx` | Restructure layout: account panel → positions → tabs. Add hash-based tab routing. |
| `app/hooks/useLiveData.ts` | Add separate polling interval for history (60s). Default `historyDays` to 3650. |

## Files to Remove/Replace

| File | Reason |
|------|--------|
| `app/components/live/LiveEquityChart.tsx` | Replaced by equity chart inside OverviewTab |
| `app/components/live/LiveTradesTable.tsx` | Replaced by TradesTab |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No trade history | Tabs show empty states ("No trades yet") |
| History fetch fails | Keep showing last known history, retry on next 60s poll |
| Account offline | Account panel shows offline. Open positions hidden. Tabs still show historical data from last successful fetch. |

## Out of Scope

- Exporting trade data (CSV, PDF)
- Custom date range filtering across tabs
- Comparing performance between accounts
- Trade annotations or journaling notes
