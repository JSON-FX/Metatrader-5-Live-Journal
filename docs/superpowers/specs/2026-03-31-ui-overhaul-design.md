# UI Overhaul Design Spec

## Overview

Overhaul the MetaTrader 5 Journal from a single-page dark-only dashboard into a professional, multi-page application with two distinct worlds (Live Trading and Backtests), Bloomberg Terminal visual style, and light/dark/system theme support.

## Tech Stack (Unchanged)

- Next.js 16 with App Router
- React 19, TypeScript 5
- Tailwind CSS 4
- Recharts for charts
- Lucide React for icons
- Geist font family (sans + mono)

## New Dependency

- `next-themes` — light/dark/system theme management with persistence

---

## 1. Routing Structure

```
/                          Landing page (status-aware cards)
/live                      Live trading dashboard
/backtests                 Report library (list/grid)
/backtests/[id]            Single report analysis (tabbed)
```

### File Structure

```
app/
├── layout.tsx             Root layout (ThemeProvider, fonts, global CSS)
├── page.tsx               Landing page
├── globals.css            Theme CSS variables + Tailwind imports
├── live/
│   ├── layout.tsx         Live layout (header with back nav + theme toggle)
│   └── page.tsx           Live dashboard
├── backtests/
│   ├── layout.tsx         Backtests layout (header with back nav + theme toggle)
│   ├── page.tsx           Report library
│   └── [id]/
│       └── page.tsx       Report detail with tabs
├── components/
│   ├── shared/
│   │   ├── Header.tsx
│   │   ├── StatCard.tsx
│   │   ├── DataTable.tsx
│   │   ├── EquityChart.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Modal.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── Sparkline.tsx
│   ├── live/
│   │   ├── LiveAccountPanel.tsx
│   │   ├── OpenPositionsTable.tsx
│   │   ├── LiveTradesTable.tsx
│   │   └── LiveEquityChart.tsx
│   └── backtest/
│       ├── ReportLibrary.tsx
│       ├── ReportCard.tsx
│       ├── ReportTabs.tsx
│       ├── ReportOverview.tsx
│       ├── ReportTrades.tsx
│       ├── ReportCalendar.tsx
│       ├── ReportPerformance.tsx
│       ├── ReportUpload.tsx
│       └── MergeBar.tsx
├── hooks/
│   └── useLiveData.ts     (existing, unchanged)
├── lib/
│   ├── types.ts           (existing)
│   ├── live-types.ts      (existing)
│   ├── parser.ts          (existing)
│   ├── storage.ts         (existing)
│   └── merge.ts           (existing)
└── api/live/              (existing API routes, unchanged)
    ├── health/route.ts
    ├── account/route.ts
    ├── positions/route.ts
    └── history/route.ts
```

---

## 2. Theme System

### Implementation

CSS custom properties defined in `globals.css`, toggled via `next-themes`. Tailwind CSS 4 consumes these variables.

### Color Tokens

| Token | Dark | Light |
|-------|------|-------|
| `--bg-primary` | `#0f172a` (slate-900) | `#f1f5f9` (slate-100) |
| `--bg-secondary` | `#1e293b` (slate-800) | `#ffffff` |
| `--bg-tertiary` | `#334155` (slate-700) | `#e2e8f0` (slate-200) |
| `--border` | `#334155` (slate-700) | `#cbd5e1` (slate-300) |
| `--text-primary` | `#f1f5f9` | `#0f172a` |
| `--text-secondary` | `#94a3b8` (slate-400) | `#64748b` (slate-500) |
| `--text-muted` | `#64748b` (slate-500) | `#94a3b8` (slate-400) |
| `--accent` | `#3b82f6` (blue-500) | `#2563eb` (blue-600) |
| `--profit` | `#22c55e` | `#16a34a` |
| `--loss` | `#ef4444` | `#dc2626` |
| `--warning` | `#f59e0b` | `#d97706` |

### Typography

- **Geist Sans**: All UI text (labels, headings, descriptions)
- **Geist Mono**: All numerical/financial data (prices, percentages, timestamps, account values)
- **Uppercase labels**: Field names use `text-transform: uppercase`, `letter-spacing: 1px`, small font size — Bloomberg Terminal convention

### Theme Toggle

Three-state cycle button in the header:
- Sun icon → Light mode
- Moon icon → Dark mode
- Monitor icon → System preference

Uses `next-themes` for persistence (localStorage) and SSR-safe hydration.

### Card Style

Consistent across both themes:
- `var(--bg-secondary)` background
- `var(--border)` border, 1px solid
- `border-radius: 8px`
- Structured padding (16px standard, 20px for larger cards)

---

## 3. Landing Page

**Route**: `/`

### Layout
- Centered content, max-width container
- App logo + name at top center
- Theme toggle in top-right corner
- Two equal-width cards side by side (responsive: stack on mobile)

### Live Trading Card
- Clock icon + "Live Trading" title
- Data rows from `/api/live/account`:
  - Balance (monospace)
  - Equity (monospace, profit-colored)
  - Open Positions count
- Mini equity sparkline (last ~20 data points from trade history)
- Connection status indicator:
  - Green dot + "Online" = bridge connected
  - Red dot + "Offline" = bridge unreachable
  - Amber dot + "Connecting" = initial load
- If offline: card still navigable, shows "Offline" instead of data
- Click navigates to `/live`

### Backtests Card
- File icon + "Backtests" title
- Data rows from localStorage:
  - Total report count
  - Last import date (relative, e.g., "2d ago")
  - Best profit across all reports
- Mini bar chart (profit/loss bars from recent reports)
- If no reports: shows "No reports yet"
- Click navigates to `/backtests`

### Data Loading
- Fetches `/api/live/health` and `/api/live/account` on mount (not continuous polling)
- If health check fails: Live card shows "Offline" status, no account data displayed
- If health succeeds but account fetch fails: Live card shows "Online" status but "Unable to load account data"
- Backtest stats read from localStorage on mount

---

## 4. Live Trading Dashboard

**Route**: `/live`

### Header
Back arrow to `/`, "Live Trading" title, connection status dot + label, theme toggle.

### Section 1 — Account Overview
Top row of stat cards (StatCard components):
- Starting Capital
- Balance
- Equity
- Floating P/L (color-coded profit/loss)
- Drawdown % (with max DD reference value)

Each card: uppercase label, large monospace value, secondary metric below.

### Section 2 — Equity Chart
- Full-width Recharts AreaChart
- Equity progression from closed trade history
- Time range filter buttons above chart: 7D / 30D / 90D / 180D / 365D
- Monospace axis labels, slate grid lines, blue area fill with gradient

### Section 3 — Open Positions
- Full-width DataTable
- Columns: Symbol, Type (Buy/Sell badge), Volume, Open Price, Current Price, SL, TP, Profit, Time Open
- Profit column color-coded (green/red)
- Sortable columns
- Empty state if no open positions

### Section 4 — Trade History
- Time range filter synced with equity chart
- Full-width DataTable
- Columns: Ticket, Symbol, Type, Volume, Open Price, Close Price, Profit, Commission, Swap, Open Time, Close Time
- Sortable, color-coded profit, paginated

### Data
`useLiveData` hook with 5s polling. All sections consume the same hook state.

---

## 5. Backtest Report Library

**Route**: `/backtests`

### Header
Back arrow to `/`, "Backtests" title, "Import Report" button (primary blue), theme toggle.

### View Modes
Toggle between grid and list view (small icons in top-right of content area).

### Grid View (default)
Responsive card grid (3 columns desktop, 2 tablet, 1 mobile). Each card:
- Symbol name as title
- Test type badge (Backtest / Forward Test / Live Trading) via StatusBadge
- Date range (start — end)
- Net profit (large, color-coded)
- Profit factor and total trades as secondary stats
- Mini equity sparkline at bottom

### List View
Compact table rows. Columns: Symbol, Type, Date Range, Net Profit, Profit Factor, Total Trades, Win Rate. Sortable by any column.

### Sorting
Sort dropdown: Date imported (default), Profit (high to low), Symbol (A-Z).

### Actions
- Click card/row → navigate to `/backtests/[id]`
- Delete: trash icon on hover, with confirmation modal
- Merge mode: checkbox toggle, select 2+ same-symbol reports, MergeBar appears at top with count + merge button. Merge confirmation modal with name input (existing functionality, restyled).

### Import Flow
"Import Report" button opens Modal with existing drag-and-drop upload zone (ReportUpload, restyled). After successful import, new report appears in library.

### Empty State
Centered EmptyState: file icon, "No reports yet", prominent "Import Report" button.

---

## 6. Single Report View

**Route**: `/backtests/[id]`

### Header
Back arrow to `/backtests`, report name (symbol + date range), theme toggle.

### Tab Bar
Horizontal tabs below header. Active tab stored in URL search params (`?tab=overview`).

### Tab 1: Overview (default)

**Stats grid**: Key metrics in dense StatCard grid (2-3 rows):
- Row 1: Net Profit, Profit Factor, Total Trades, Win Rate
- Row 2: Expected Payoff, Sharpe Ratio, Max Drawdown, Recovery Factor
- Row 3: Gross Profit, Gross Loss, Avg Win, Avg Loss

All with uppercase labels, monospace values, color-coded where appropriate.

**Equity chart**: Full-width AreaChart with balance line and initial deposit reference line.

**Strategy settings**: Collapsible section showing EA settings, symbol, period, spread, initial deposit, leverage.

### Tab 2: Trades

**Filter buttons**: All / Profit / Loss toggle.

**Trades table**: DataTable with deal data:
- Columns: Time, Type, Symbol, Volume, Price, Profit, Balance
- Color-coded profit column, sortable, paginated

**Trade count chart**: Daily trade count mini chart (existing TradeCountChart, restyled).

### Tab 3: Calendar

**Monthly calendar grid**: CalendarView component (restyled):
- Daily P/L cells, color-coded green/red
- Week totals in side column
- Month navigation arrows

**Win streaks card**: Current and max win/loss streaks (days + trades). Existing WinstreakCard restyled with Lucide icon replacing custom SVG FireIcon.

### Tab 4: Performance

**Yearly performance grid**: YearlyPerformance component (restyled):
- 12-month table, toggle between currency and percent display
- Row per year, column per month
- Color intensity proportional to magnitude

**Risk breakdown**: Per-report risk exposure and worst-case drawdown stats from existing report data.

---

## 7. Shared Components

### Header
- Props: `title`, `backHref?`, `actions?` (React nodes for right side)
- Renders: back arrow (if backHref), logo, title, actions slot, ThemeToggle
- Consistent across all pages

### StatCard
- Props: `label`, `value`, `secondaryValue?`, `variant?` (default/profit/loss/warning/accent)
- Renders: uppercase label, large monospace value, optional secondary line
- Color-coded based on variant

### DataTable
- Props: `columns` (definition array), `data`, `sortable?`, `pagination?`, `pageSize?`
- Generic sortable/paginated table
- Column definitions specify: key, label, render function, sortable flag
- Handles empty state internally

### EquityChart
- Props: `data` (array of {time, value}), `height?`, `showReferenceLine?`, `referenceValue?`
- Recharts AreaChart with consistent styling
- Blue gradient fill, monospace axes, slate grid

### StatusBadge
- Props: `label`, `variant` (buy/sell, online/offline, backtest/forward/live)
- Small colored pill badge

### EmptyState
- Props: `icon`, `title`, `description?`, `action?` (button config)
- Centered layout with icon, message, optional CTA

### Modal
- Props: `open`, `onClose`, `title`, `children`
- Overlay dialog with backdrop, close button, consistent styling

### ThemeToggle
- Three-state cycle: light → dark → system
- Icons: Sun, Moon, Monitor (from Lucide)
- Uses `next-themes` `setTheme` / `resolvedTheme`

### Sparkline
- Props: `data` (number array), `color?`, `height?`, `width?`
- Tiny inline SVG line chart for embedding in cards

---

## 8. Migration Notes

### What stays the same
- All data logic: parser.ts, storage.ts, merge.ts, types.ts, live-types.ts
- API routes: all four /api/live/* routes unchanged
- useLiveData hook: unchanged
- Recharts as charting library
- Lucide React as icon library
- localStorage for backtest persistence

### What changes
- Single page.tsx → multiple route pages
- All 13 existing components → restyled and reorganized into shared/live/backtest folders
- globals.css → expanded with CSS custom properties for theming
- layout.tsx → ThemeProvider wrapper added
- Dark-only color scheme → CSS variable-based dual theme
- Custom SVG FireIcon in WinstreakCard → Lucide `Flame` icon
- Zinc color palette → Slate color palette (Bloomberg style)

### What's new
- `next-themes` dependency
- ThemeToggle component
- Landing page (`/`)
- Report library view with grid/list toggle
- Tabbed navigation in report detail view
- Shared component library (Header, StatCard, DataTable, etc.)
- URL-based tab persistence via search params

### What's removed
- Nothing is removed — all existing functionality is preserved and reorganized
