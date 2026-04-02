# Backtest UI Unification Design

**Date:** 2026-04-02
**Goal:** Update backtest report views to match the live trading tabs UI across three areas: calendar streaks, performance grid, and $/% display toggle.

## Context

The live trading tabs were recently rebuilt with a cleaner design. The backtest detail view (`/backtests/[id]`) still uses the older UI patterns. This spec unifies them so the app has a consistent look.

## 1. Shared StreaksTable Component

### Problem
- **Live:** Table with Current/Longest columns, 4 rows (Winning Days, Losing Days, Winning Trades, Losing Trades), two side-by-side cards (Month Streaks + All-Time Streaks)
- **Backtest:** Single "Win Streaks" card with only winning streaks, current + max, no table layout

### Solution
Extract a shared `StreaksTable` component from live's `CalendarTab`.

**New file:** `app/components/shared/StreaksTable.tsx`

```tsx
interface StreaksTableProps {
  title: string;       // e.g. "January Streaks", "All-Time Streaks"
  streaks: StreakData;  // from trade-stats.ts
}
```

Pure presentation: card with title, 4-row × 2-column table (Current, Longest), flame icons. Both live and backtest import this.

**New function:** `calculateStreaksFromDeals(deals: MT5Deal[], dateRange?: { start: string; end: string }): StreakData` in `app/lib/trade-stats.ts`

- Takes MT5Deal array, returns same `StreakData` shape as `calculateStreaks()`
- Optional `dateRange` parameter filters deals to a date range (for month-scoped streaks)
- Backtest "monthly" streaks are scoped to the **currently selected calendar month** (not the real-world current month), so they stay useful regardless of when the backtest was run

**Modified files:**
- `app/components/live/CalendarTab.tsx` — replace inline streaks markup with `<StreaksTable>`
- `app/components/backtest/ReportCalendar.tsx` — replace old "Win Streaks" card with two `<StreaksTable>` cards (month + all-time), remove local streak calculation

## 2. Performance Grid

### Problem
- **Live:** Clean `<table>` with year rows, 12 month columns + total. Colored text only, no boxes, no trade counts.
- **Backtest:** Colored bordered boxes (`border border-accent/20 bg-accent/5`) with trade count shown as "Xt". Local $/% toggle inside the card.

### Solution
Rewrite `ReportPerformance`'s yearly grid to match live's `PerformanceTab` table markup.

**Changes to `app/components/backtest/ReportPerformance.tsx`:**
- Replace colored box grid with plain `<table>` matching `PerformanceTab` style
- Each cell: colored text value only (no boxes, no trade count)
- Remove local `displayMode` state and local `formatValue` function
- Accept `displayMode` as a prop; use shared `formatValue()` from `trade-stats.ts`
- Keep the "Risk Breakdown" StatCard section at the bottom (unique to backtests)

**No shared component extraction.** The table markup is simple and the data sources differ (`LiveTrade[]` vs `MT5Deal[]`). Both sides just match the same visual pattern.

## 3. Global $/% Toggle

### Problem
- **Live:** `DisplayModeToggle` sits at tab bar level (right-aligned next to tabs), state managed in `live/page.tsx`, passed to all tab components
- **Backtest:** Toggle is local to `ReportPerformance` component only, doesn't affect other tabs

### Solution
Lift display mode state to backtest page level, matching live's pattern.

**Move file:** `app/components/live/DisplayModeToggle.tsx` → `app/components/shared/DisplayModeToggle.tsx`

The `DisplayMode` type stays in `app/lib/live-types.ts` (it's a simple `'money' | 'percent'` union — moving it isn't worth the churn).

**Changes to `app/components/backtest/ReportTabs.tsx`:**
- Accept an optional `rightSlot?: React.ReactNode` prop
- Render it right-aligned in the tab bar row (same position as live)

**Changes to `app/backtests/[id]/page.tsx`:**
- Add `displayMode` state (default `'money'`)
- Render `<DisplayModeToggle>` in the `rightSlot` of `<ReportTabs>`
- Pass `displayMode` to all tab components

**Changes to backtest tab components (accept `displayMode` prop):**
- `ReportCalendar.tsx` — use `formatValue()` from `trade-stats.ts` instead of local `formatCurrency()` for calendar cell values
- `ReportPerformance.tsx` — receive `displayMode` as prop (no local state)
- `ReportOverview.tsx` — accept `displayMode` prop, use for stat display values

**Changes to live imports:**
- `app/live/page.tsx` — update import path from `live/DisplayModeToggle` to `shared/DisplayModeToggle`

## Files Summary

### Created
| File | Purpose |
|------|---------|
| `app/components/shared/StreaksTable.tsx` | Shared streaks table (4 rows × 2 cols) |
| `app/components/shared/DisplayModeToggle.tsx` | Moved from live, now shared |

### Modified
| File | Changes |
|------|---------|
| `app/lib/trade-stats.ts` | Add `calculateStreaksFromDeals()` |
| `app/components/backtest/ReportCalendar.tsx` | New streaks tables, accept `displayMode`, use `formatValue()` |
| `app/components/backtest/ReportPerformance.tsx` | Clean table style, accept `displayMode` prop, remove local state/formatValue |
| `app/components/backtest/ReportOverview.tsx` | Accept `displayMode` prop |
| `app/components/backtest/ReportTabs.tsx` | Add `rightSlot` prop |
| `app/backtests/[id]/page.tsx` | Manage `displayMode` state, wire toggle + props |
| `app/components/live/CalendarTab.tsx` | Use shared `StreaksTable` |
| `app/live/page.tsx` | Update `DisplayModeToggle` import path |

### Deleted
| File | Reason |
|------|--------|
| `app/components/live/DisplayModeToggle.tsx` | Moved to shared |
