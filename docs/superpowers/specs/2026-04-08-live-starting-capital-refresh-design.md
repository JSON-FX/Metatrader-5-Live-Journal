# Live Starting Capital Fix & Refresh Button

**Date:** 2026-04-08

## Problem

Starting capital and all derived metrics (equity curve, net profit %, drawdown %, etc.) are inaccurate on the live trading dashboard because:

1. **Wrong calculation:** Every tab computes `startingCapital = balance - totalPnl`. When trade history hasn't loaded yet, `totalPnl = 0`, so starting capital shows as current balance (e.g., $493.79 instead of the actual deposit amount).
2. **Duplicated logic:** Six components each independently calculate starting capital, with slightly different approaches (e.g., OrdersDealsTab filters for `entry === 'out'` while others don't).
3. **No manual refresh:** Users must wait for the 60s poll cycle to get fresh data — no way to force a re-fetch.

## Solution

### 1. Deposit-based Starting Capital

Calculate starting capital from `rawDeals` where `type === 'balance'` — these are deposit/withdrawal records from MT5:

```ts
const startingCapital = rawDeals
  .filter(d => d.type === 'balance')
  .reduce((sum, d) => sum + d.profit, 0);
```

Compute once in `page.tsx`, pass as prop to all tabs. Remove all per-tab calculations.

### 2. Refresh Button

Expose `refresh()` from `useLiveData` hook. Button placed next to settings gear, uses `RefreshCw` icon that spins during refresh.

## Files Changed

| File | Change |
|------|--------|
| `app/hooks/useLiveData.ts` | Add `refresh()` to returned state, add `refreshing` flag |
| `app/live/page.tsx` | Compute `startingCapital` from `rawDeals`, pass to all tabs, render refresh button |
| `app/components/live/LiveAccountPanel.tsx` | Replace internal calc with `startingCapital` prop |
| `app/components/live/OverviewTab.tsx` | Replace `balance` prop with `startingCapital` prop |
| `app/components/live/TradesTab.tsx` | Replace internal calc with `startingCapital` prop |
| `app/components/live/CalendarTab.tsx` | Replace internal calc with `startingCapital` prop |
| `app/components/live/PerformanceTab.tsx` | Replace internal calc with `startingCapital` prop |
| `app/components/live/OrdersDealsTab.tsx` | Replace internal calc with `startingCapital` prop |
