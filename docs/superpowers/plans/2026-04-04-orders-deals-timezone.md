# Orders & Deals Tab, Trades Tab Updates, and Timezone System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Orders & Deals tab showing raw MT5 deals/orders, add Open Time column to Trades tab, and implement a global timezone system with 12-hour time format.

**Architecture:** Three layers of change: (1) Flask bridge gets two new endpoints returning raw deals and orders, (2) Next.js proxy routes + data hook expose data to React, (3) UI components consume the data with timezone-aware formatting powered by a SettingsContext provider.

**Tech Stack:** Python/Flask (MT5 bridge), Next.js 16 / React 19, TypeScript, MySQL (settings persistence), date-fns + date-fns-tz (time formatting), Tailwind CSS v4.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `vps-bridge/mt5_api.py` | Add `/raw-deals` and `/raw-orders` Flask endpoints |
| Create | `app/api/live/raw-deals/route.ts` | Proxy to Flask `/raw-deals` |
| Create | `app/api/live/raw-orders/route.ts` | Proxy to Flask `/raw-orders` |
| Create | `app/api/settings/route.ts` | GET/PUT app settings from MySQL |
| Modify | `app/lib/db.ts` | Add `app_settings` table to `ensureDatabase()` |
| Modify | `app/lib/live-types.ts` | Add `RawDeal`, `RawOrder` interfaces |
| Modify | `app/hooks/useLiveData.ts` | Poll raw-deals and raw-orders on slow interval |
| Create | `app/lib/settings-context.tsx` | SettingsContext + SettingsProvider with timezone |
| Create | `app/lib/format-datetime.ts` | Shared `formatDateTime()` utility using date-fns-tz |
| Modify | `app/layout.tsx` | Wrap children with SettingsProvider |
| Modify | `app/lib/trade-stats.ts` | Update `groupByDay()` and `groupByMonth()` to accept timezone |
| Modify | `app/components/live/LiveTabs.tsx` | Add `'orders-deals'` to TabId |
| Create | `app/components/live/OrdersDealsTab.tsx` | Combined orders/deals chronological table |
| Modify | `app/components/live/TradesTab.tsx` | Add Open Time column, use `formatDateTime` |
| Modify | `app/components/live/CalendarTab.tsx` | Use timezone-aware date grouping |
| Modify | `app/components/live/PerformanceTab.tsx` | Use timezone-aware month grouping |
| — | `app/components/live/OverviewTab.tsx` | No changes needed (chart labels use short date format, no time formatting) |
| Modify | `app/live/page.tsx` | Wire up OrdersDealsTab, pass raw data |
| Modify | `app/live/settings/page.tsx` | Add timezone picker section |

---

### Task 1: Install date-fns-tz

- [ ] **Step 1: Install the package**

```bash
npm install date-fns-tz
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('date-fns-tz'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add date-fns-tz for timezone conversion"
```

---

### Task 2: Add `app_settings` Table and Settings API

**Files:**
- Modify: `app/lib/db.ts`
- Create: `app/api/settings/route.ts`

- [ ] **Step 1: Add `app_settings` table to `ensureDatabase()` in `app/lib/db.ts`**

Add after the `ALTER TABLE mt5_accounts` block (after line 72, before `initialized = true`):

```typescript
  await p.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(50) PRIMARY KEY,
      setting_value TEXT NOT NULL
    )
  `);

  // Seed default timezone if not exists
  await p.execute(`
    INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('timezone', 'UTC')
  `);
```

- [ ] **Step 2: Create `app/api/settings/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  const db = await getDb();
  const [rows] = await db.execute<RowDataPacket[]>('SELECT setting_key, setting_value FROM app_settings');
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.setting_key] = row.setting_value;
  }
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = await getDb();

  for (const [key, value] of Object.entries(body)) {
    if (typeof key !== 'string' || typeof value !== 'string') continue;
    await db.execute(
      'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [key, value]
    );
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify the settings API works**

```bash
curl -s http://localhost:3000/api/settings | head
```

Expected: `{"timezone":"UTC"}`

- [ ] **Step 4: Commit**

```bash
git add app/lib/db.ts app/api/settings/route.ts
git commit -m "feat: add app_settings table and settings API route"
```

---

### Task 3: Create SettingsContext and formatDateTime Utility

**Files:**
- Create: `app/lib/settings-context.tsx`
- Create: `app/lib/format-datetime.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `app/lib/settings-context.tsx`**

```tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface SettingsContextType {
  timezone: string;
  setTimezone: (tz: string) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  timezone: 'UTC',
  setTimezone: () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState('UTC');

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.timezone) setTimezoneState(data.timezone);
      })
      .catch(() => {});
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: tz }),
    }).catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </SettingsContext.Provider>
  );
}
```

- [ ] **Step 2: Create `app/lib/format-datetime.ts`**

```typescript
import { toZonedTime, format as formatTz } from 'date-fns-tz';
import { parseISO } from 'date-fns';

/**
 * Format an ISO 8601 UTC string to the user's timezone in 12-hour format.
 * Output: "yyyy/MM/dd h:mm:ss a" (e.g., "2026/04/04 7:30:01 AM")
 */
export function formatDateTime(isoString: string, timezone: string): string {
  try {
    const date = parseISO(isoString);
    const zonedDate = toZonedTime(date, timezone);
    return formatTz(zonedDate, 'yyyy/MM/dd h:mm:ss a', { timeZone: timezone });
  } catch {
    return isoString;
  }
}

/**
 * Get the YYYY-MM-DD date string for an ISO timestamp in a given timezone.
 * Used for grouping trades by day respecting timezone.
 */
export function getDateInTimezone(isoString: string, timezone: string): string {
  try {
    const date = parseISO(isoString);
    const zonedDate = toZonedTime(date, timezone);
    return formatTz(zonedDate, 'yyyy-MM-dd', { timeZone: timezone });
  } catch {
    return isoString.slice(0, 10);
  }
}

/**
 * Get year and month (0-11) for an ISO timestamp in a given timezone.
 * Used for grouping trades by month respecting timezone.
 */
export function getYearMonthInTimezone(isoString: string, timezone: string): { year: number; month: number } {
  try {
    const date = parseISO(isoString);
    const zonedDate = toZonedTime(date, timezone);
    return {
      year: zonedDate.getFullYear(),
      month: zonedDate.getMonth(),
    };
  } catch {
    return {
      year: parseInt(isoString.slice(0, 4), 10),
      month: parseInt(isoString.slice(5, 7), 10) - 1,
    };
  }
}
```

- [ ] **Step 3: Wrap app with SettingsProvider in `app/layout.tsx`**

Change the body content from:

```tsx
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
```

To:

```tsx
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SettingsProvider>
            {children}
          </SettingsProvider>
        </ThemeProvider>
```

Add the import at the top:

```typescript
import { SettingsProvider } from './lib/settings-context';
```

- [ ] **Step 4: Verify the app still builds**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/lib/settings-context.tsx app/lib/format-datetime.ts app/layout.tsx
git commit -m "feat: add SettingsContext provider and formatDateTime utility"
```

---

### Task 4: Update Trades Tab — Add Open Time Column and Use formatDateTime

**Files:**
- Modify: `app/components/live/TradesTab.tsx`

- [ ] **Step 1: Update imports**

Replace the existing import line:

```typescript
import { format, parseISO } from 'date-fns';
```

With:

```typescript
import { formatDateTime } from '../../lib/format-datetime';
import { useSettings } from '../../lib/settings-context';
```

- [ ] **Step 2: Remove the old `formatDate` function**

Delete lines 25-28:

```typescript
function formatDate(isoString: string): string {
  try { return format(parseISO(isoString), 'yyyy/MM/dd HH:mm:ss'); }
  catch { return isoString; }
}
```

- [ ] **Step 3: Add `useSettings` hook inside the component**

Add at the start of the `TradesTab` function body (after the line `const [filterType, setFilterType] = useState<FilterType>('all');`):

```typescript
  const { timezone } = useSettings();
```

- [ ] **Step 4: Replace the `close_time` column with `open_time` + `close_time` columns**

Replace the existing close_time column definition:

```typescript
    {
      key: 'close_time', label: 'Close Time',
      render: (row) => <span className="text-text-muted text-xs">{formatDate(row.trade.close_time)}</span>,
      sortable: true, sortValue: (row) => row.trade.close_time,
    },
```

With two columns:

```typescript
    {
      key: 'open_time', label: 'Open Time',
      render: (row) => <span className="text-text-muted text-xs">{formatDateTime(row.trade.open_time, timezone)}</span>,
      sortable: true, sortValue: (row) => row.trade.open_time,
    },
    {
      key: 'close_time', label: 'Close Time',
      render: (row) => <span className="text-text-muted text-xs">{formatDateTime(row.trade.close_time, timezone)}</span>,
      sortable: true, sortValue: (row) => row.trade.close_time,
    },
```

- [ ] **Step 5: Verify the app builds**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/components/live/TradesTab.tsx
git commit -m "feat: add Open Time column to Trades tab, use 12-hour timezone formatting"
```

---

### Task 5: Update trade-stats.ts — Timezone-Aware Grouping

**Files:**
- Modify: `app/lib/trade-stats.ts`

- [ ] **Step 1: Add import for timezone helpers**

Add at the top of the file, after existing imports:

```typescript
import { getDateInTimezone, getYearMonthInTimezone } from './format-datetime';
```

- [ ] **Step 2: Update `groupByDay()` to accept timezone parameter**

Replace the existing `groupByDay` function:

```typescript
export function groupByDay(trades: LiveTrade[]): DailyPnl[] {
  const map = new Map<string, DailyPnl>();

  for (const t of trades) {
    const date = t.close_time.slice(0, 10);
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
```

With:

```typescript
export function groupByDay(trades: LiveTrade[], timezone: string = 'UTC'): DailyPnl[] {
  const map = new Map<string, DailyPnl>();

  for (const t of trades) {
    const date = getDateInTimezone(t.close_time, timezone);
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
```

- [ ] **Step 3: Update `groupByMonth()` to accept timezone parameter**

Replace the existing `groupByMonth` function:

```typescript
export function groupByMonth(trades: LiveTrade[]): MonthlyPnl[] {
  const map = new Map<string, MonthlyPnl>();

  for (const t of trades) {
    const year = parseInt(t.close_time.slice(0, 4), 10);
    const month = parseInt(t.close_time.slice(5, 7), 10) - 1;
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
```

With:

```typescript
export function groupByMonth(trades: LiveTrade[], timezone: string = 'UTC'): MonthlyPnl[] {
  const map = new Map<string, MonthlyPnl>();

  for (const t of trades) {
    const { year, month } = getYearMonthInTimezone(t.close_time, timezone);
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
```

- [ ] **Step 4: Update `calculateStreaks()` — pass timezone to `groupByDay`**

In the `calculateStreaks` function, change line 165:

```typescript
  const daily = groupByDay(trades);
```

To:

```typescript
  const daily = groupByDay(trades, timezone);
```

And update the function signature from:

```typescript
export function calculateStreaks(trades: LiveTrade[]): StreakData {
```

To:

```typescript
export function calculateStreaks(trades: LiveTrade[], timezone: string = 'UTC'): StreakData {
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/lib/trade-stats.ts
git commit -m "feat: timezone-aware date grouping in trade stats"
```

---

### Task 6: Update CalendarTab, PerformanceTab, and OverviewTab for Timezone

**Files:**
- Modify: `app/components/live/CalendarTab.tsx`
- Modify: `app/components/live/PerformanceTab.tsx`
- Modify: `app/components/live/OverviewTab.tsx`

- [ ] **Step 1: Update CalendarTab.tsx**

Add import at the top:

```typescript
import { useSettings } from '../../lib/settings-context';
```

Inside the component function, add after the existing state declarations:

```typescript
  const { timezone } = useSettings();
```

Find the `useMemo` that calls `groupByDay` and `calculateStreaks` and pass `timezone`:

Change:

```typescript
  const dailyData = useMemo(() => groupByDay(trades), [trades]);
```

To:

```typescript
  const dailyData = useMemo(() => groupByDay(trades, timezone), [trades, timezone]);
```

And change:

```typescript
  const streaks = useMemo(() => calculateStreaks(trades), [trades]);
```

To:

```typescript
  const streaks = useMemo(() => calculateStreaks(trades, timezone), [trades, timezone]);
```

- [ ] **Step 2: Update PerformanceTab.tsx**

Add import at the top:

```typescript
import { useSettings } from '../../lib/settings-context';
```

Inside the component function, add:

```typescript
  const { timezone } = useSettings();
```

Find the `useMemo` that calls `groupByMonth` and pass `timezone`:

Change:

```typescript
  const monthly = useMemo(() => groupByMonth(trades), [trades]);
```

To:

```typescript
  const monthly = useMemo(() => groupByMonth(trades, timezone), [trades, timezone]);
```

- [ ] **Step 3: Update OverviewTab.tsx**

Add imports at the top:

```typescript
import { formatDateTime } from '../../lib/format-datetime';
import { useSettings } from '../../lib/settings-context';
```

Inside the component function, add:

```typescript
  const { timezone } = useSettings();
```

Find the equity curve `useMemo` that formats dates. Change the time formatting from:

```typescript
    time: format(parseISO(p.time), 'MMM d, yyyy'),
```

To:

```typescript
    time: formatDateTime(p.time, timezone).split(' ').slice(0, 1)[0],
```

Wait — the equity curve chart uses short date labels like "Apr 4, 2026". The `formatDateTime` outputs `yyyy/MM/dd h:mm:ss a` which is too long for a chart axis. For the chart label, keep the existing `format(parseISO(...))` for the display label but update the `useMemo` deps to include `timezone`. The date string comparison for filtering also needs timezone awareness.

Actually, let me reconsider. The OverviewTab equity curve labels are for the chart X-axis — they show dates, not times. The timezone shift could change which date a trade falls on, but the chart labels themselves don't need 12-hour formatting. The key change is: if there's any time formatting in OverviewTab, use `formatDateTime`. If it's only date labels for the chart, leave the chart label formatting as-is but ensure the underlying data (grouping/filtering) respects timezone.

Looking at the code: OverviewTab uses `format(parseISO(p.time), 'MMM d, yyyy')` for chart labels and `p.rawTime.slice(0, 10)` for date range filtering. The date range filtering should use timezone-aware extraction.

Update the equity curve `useMemo`:

Change:

```typescript
  const equityCurve = useMemo(() => {
    const points = calculateEquityCurve(trades, startingCapital);
    return points.map(p => ({
      time: format(parseISO(p.time), 'MMM d, yyyy'),
      rawTime: p.time,
      value: p.value,
    }));
  }, [trades, startingCapital]);
```

To:

```typescript
  const equityCurve = useMemo(() => {
    const points = calculateEquityCurve(trades, startingCapital);
    return points.map(p => ({
      time: format(parseISO(p.time), 'MMM d, yyyy'),
      rawTime: p.time,
      value: p.value,
    }));
  }, [trades, startingCapital]);
```

Actually this doesn't need changes — the chart label format is fine as-is (short date for chart axis). The existing `format(parseISO(isoString))` import from `date-fns` should stay for chart labels. Remove the unused `formatDateTime` import from OverviewTab if we don't need it.

The only thing OverviewTab might need is: if it calls `groupByDay` or `calculateStreaks`, pass timezone. Let me check — OverviewTab calls `calculateStats` and `calculateEquityCurve`. Neither uses timezone-sensitive grouping. The date filtering (`slice(0, 10)`) compares raw UTC dates, which is fine since the date input also works in UTC for the equity curve filter.

**Revised Step 3:** OverviewTab needs minimal changes. If it imports `calculateStreaks`, pass timezone. Otherwise, leave it mostly unchanged. Add `useSettings` import only if there are streaks or time displays to update.

Check if OverviewTab calls `calculateStreaks`:

Looking at the OverviewTab code from the exploration: it calls `calculateStats` and `calculateEquityCurve` but NOT `calculateStreaks` or `groupByDay`. It also formats dates with `format(parseISO(p.time), 'MMM d, yyyy')` for the chart axis.

So the OverviewTab changes are:
- No functional changes needed for timezone (it doesn't group by day/month)
- Chart axis labels stay as-is (short date format is fine for charts)
- The date range filter (`rawTime.slice(0, 10)`) operates on UTC which is consistent with the chart data

**Step 3 is: no changes to OverviewTab.** Skip it.

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/components/live/CalendarTab.tsx app/components/live/PerformanceTab.tsx
git commit -m "feat: use timezone-aware grouping in Calendar and Performance tabs"
```

---

### Task 7: Add Flask Bridge Endpoints — `/raw-deals` and `/raw-orders`

**Files:**
- Modify: `vps-bridge/mt5_api.py`

- [ ] **Step 1: Add `/raw-deals` endpoint**

Add before the `# Symbol price` section (before line 388), after the `/history` endpoint:

```python
# ─────────────────────────────────────────────────────────────────────────────
# Raw deals (unpaired)
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/raw-deals", methods=["GET"])
def get_raw_deals():
    """
    Returns all historical deals without pairing.
    Includes trading deals (buy/sell), balance operations, credits, etc.
    """
    if not ensure_connected():
        return error_response("MT5 not connected")

    try:
        days = min(int(request.args.get("days", 90)), 3650)
    except (ValueError, TypeError):
        days = 90

    from_date = datetime.now(timezone.utc) - timedelta(days=days)
    to_date   = datetime.now(timezone.utc)

    deals = mt5.history_deals_get(from_date, to_date)

    if deals is None:
        if mt5.last_error()[0] != 0:
            return error_response("Failed to retrieve deals")
        return jsonify([])

    type_map = {
        0: "buy", 1: "sell", 2: "balance", 3: "credit",
        4: "charge", 5: "correction",
    }
    entry_map = {0: "in", 1: "out", 2: "reverse"}

    result = []
    for deal in deals:
        d = deal._asdict()
        result.append({
            "ticket":      d.get("ticket"),
            "position_id": d.get("position_id", 0),
            "symbol":      d.get("symbol", ""),
            "type":        type_map.get(d.get("type", -1), "other"),
            "entry":       entry_map.get(d.get("entry", -1), ""),
            "volume":      round(d.get("volume", 0), 2),
            "price":       round(d.get("price", 0), 5),
            "profit":      round(d.get("profit", 0), 2),
            "commission":  round(d.get("commission", 0), 2),
            "swap":        round(d.get("swap", 0), 2),
            "time":        datetime.fromtimestamp(
                               d.get("time", 0), tz=timezone.utc
                           ).isoformat(),
            "comment":     d.get("comment", ""),
            "magic":       d.get("magic", 0),
        })

    # Most recent first
    result.sort(key=lambda d: d["time"], reverse=True)
    return jsonify(result)
```

- [ ] **Step 2: Add `/raw-orders` endpoint**

Add immediately after the `/raw-deals` endpoint:

```python
# ─────────────────────────────────────────────────────────────────────────────
# Raw historical orders
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/raw-orders", methods=["GET"])
def get_raw_orders():
    """
    Returns all historical orders (filled, canceled, expired, etc.).
    """
    if not ensure_connected():
        return error_response("MT5 not connected")

    try:
        days = min(int(request.args.get("days", 90)), 3650)
    except (ValueError, TypeError):
        days = 90

    from_date = datetime.now(timezone.utc) - timedelta(days=days)
    to_date   = datetime.now(timezone.utc)

    orders = mt5.history_orders_get(from_date, to_date)

    if orders is None:
        if mt5.last_error()[0] != 0:
            return error_response("Failed to retrieve historical orders")
        return jsonify([])

    type_map = {
        0: "buy",            1: "sell",
        2: "buy_limit",      3: "sell_limit",
        4: "buy_stop",       5: "sell_stop",
        6: "buy_stop_limit", 7: "sell_stop_limit",
    }
    state_map = {
        0: "started", 1: "placed", 2: "canceled",
        3: "partial", 4: "filled", 5: "rejected", 6: "expired",
    }

    result = []
    for order in orders:
        d = order._asdict()
        result.append({
            "ticket":         d.get("ticket"),
            "position_id":    d.get("position_id", 0),
            "symbol":         d.get("symbol", ""),
            "type":           type_map.get(d.get("type", -1), "unknown"),
            "volume_initial": round(d.get("volume_initial", 0), 2),
            "volume_current": round(d.get("volume_current", 0), 2),
            "price":          round(d.get("price_open", 0), 5),
            "sl":             d.get("sl") or None,
            "tp":             d.get("tp") or None,
            "state":          state_map.get(d.get("state", -1), "unknown"),
            "time_setup":     datetime.fromtimestamp(
                                  d.get("time_setup", 0), tz=timezone.utc
                              ).isoformat(),
            "time_done":      datetime.fromtimestamp(
                                  d.get("time_done", 0), tz=timezone.utc
                              ).isoformat(),
            "comment":        d.get("comment", ""),
            "magic":          d.get("magic", 0),
        })

    # Most recent first
    result.sort(key=lambda d: d["time_setup"], reverse=True)
    return jsonify(result)
```

- [ ] **Step 3: Update the docstring at the top of the file**

Add the two new endpoints to the `ENDPOINTS` docstring (around line 38):

```python
GET /raw-deals?days=90   — All historical deals (unpaired)
GET /raw-orders?days=90  — All historical orders (filled, canceled, etc.)
```

- [ ] **Step 4: Commit**

```bash
git add vps-bridge/mt5_api.py
git commit -m "feat: add /raw-deals and /raw-orders Flask endpoints"
```

---

### Task 8: Add Next.js Proxy Routes and TypeScript Types

**Files:**
- Create: `app/api/live/raw-deals/route.ts`
- Create: `app/api/live/raw-orders/route.ts`
- Modify: `app/lib/live-types.ts`

- [ ] **Step 1: Create `app/api/live/raw-deals/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { resolveEndpoint } from '../../../lib/accounts';

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('accountId');
  const days = req.nextUrl.searchParams.get('days') ?? '90';
  const resolved = await resolveEndpoint(accountId);

  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  try {
    const res = await fetch(`${resolved.endpoint}/raw-deals?days=${days}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'MT5 raw deals unavailable' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'MT5 unreachable' }, { status: 503 });
  }
}
```

- [ ] **Step 2: Create `app/api/live/raw-orders/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { resolveEndpoint } from '../../../lib/accounts';

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('accountId');
  const days = req.nextUrl.searchParams.get('days') ?? '90';
  const resolved = await resolveEndpoint(accountId);

  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  try {
    const res = await fetch(`${resolved.endpoint}/raw-orders?days=${days}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'MT5 raw orders unavailable' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'MT5 unreachable' }, { status: 503 });
  }
}
```

- [ ] **Step 3: Add `RawDeal` and `RawOrder` interfaces to `app/lib/live-types.ts`**

Add after the `LiveTrade` interface (after line 49):

```typescript
export interface RawDeal {
  ticket: number;
  position_id: number;
  symbol: string;
  type: 'buy' | 'sell' | 'balance' | 'credit' | 'charge' | 'correction' | 'other';
  entry: 'in' | 'out' | 'reverse' | '';
  volume: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
  time: string;
  comment: string;
  magic: number;
}

export interface RawOrder {
  ticket: number;
  position_id: number;
  symbol: string;
  type: 'buy' | 'sell' | 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop' | 'buy_stop_limit' | 'sell_stop_limit' | 'unknown';
  volume_initial: number;
  volume_current: number;
  price: number;
  sl: number | null;
  tp: number | null;
  state: 'started' | 'placed' | 'canceled' | 'partial' | 'filled' | 'rejected' | 'expired' | 'unknown';
  time_setup: string;
  time_done: string;
  comment: string;
  magic: number;
}
```

Also add the new fields to the `LiveDataState` interface. Change:

```typescript
export interface LiveDataState {
  status: LiveStatus;
  account: LiveAccountInfo | null;
  positions: LivePosition[];
  history: LiveTrade[];
  lastUpdated: Date | null;
  error: string | null;
}
```

To:

```typescript
export interface LiveDataState {
  status: LiveStatus;
  account: LiveAccountInfo | null;
  positions: LivePosition[];
  history: LiveTrade[];
  rawDeals: RawDeal[];
  rawOrders: RawOrder[];
  lastUpdated: Date | null;
  error: string | null;
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: May have type errors from `useLiveData` not returning `rawDeals`/`rawOrders` yet — that's expected and fixed in the next task.

- [ ] **Step 5: Commit**

```bash
git add app/api/live/raw-deals/route.ts app/api/live/raw-orders/route.ts app/lib/live-types.ts
git commit -m "feat: add raw-deals and raw-orders proxy routes and TypeScript types"
```

---

### Task 9: Update useLiveData Hook — Poll Raw Deals and Orders

**Files:**
- Modify: `app/hooks/useLiveData.ts`

- [ ] **Step 1: Add `RawDeal` and `RawOrder` imports**

Change the import line:

```typescript
import { LiveDataState, LiveAccountInfo, LivePosition, LiveTrade } from '../lib/live-types';
```

To:

```typescript
import { LiveDataState, LiveAccountInfo, LivePosition, LiveTrade, RawDeal, RawOrder } from '../lib/live-types';
```

- [ ] **Step 2: Add initial state for rawDeals and rawOrders**

In the `useState` initial state object, add the two new arrays. Change:

```typescript
  const [state, setState] = useState<LiveDataState>({
    status: 'connecting',
    account: null,
    positions: [],
    history: [],
    lastUpdated: null,
    error: null,
  });
```

To:

```typescript
  const [state, setState] = useState<LiveDataState>({
    status: 'connecting',
    account: null,
    positions: [],
    history: [],
    rawDeals: [],
    rawOrders: [],
    lastUpdated: null,
    error: null,
  });
```

Also update the reset in the `useEffect` (the `setState` call at the top of the effect):

```typescript
    setState({
      status: 'connecting',
      account: null,
      positions: [],
      history: [],
      rawDeals: [],
      rawOrders: [],
      lastUpdated: null,
      error: null,
    });
```

- [ ] **Step 3: Add refs for last known raw data**

After the existing `lastHistory` ref:

```typescript
  const lastHistory = useRef<LiveTrade[]>([]);
```

Add:

```typescript
  const lastRawDeals = useRef<RawDeal[]>([]);
  const lastRawOrders = useRef<RawOrder[]>([]);
```

And reset them alongside `lastHistory.current = []`:

```typescript
    lastHistory.current = [];
    lastRawDeals.current = [];
    lastRawOrders.current = [];
```

- [ ] **Step 4: Update `pollHistory` to also fetch raw deals and orders**

Replace the existing `pollHistory` function:

```typescript
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
```

With:

```typescript
    async function pollHistory() {
      try {
        const [historyRes, dealsRes, ordersRes] = await Promise.all([
          fetch(`/api/live/history?${q}&days=${HISTORY_DAYS}`),
          fetch(`/api/live/raw-deals?${q}&days=${HISTORY_DAYS}`),
          fetch(`/api/live/raw-orders?${q}&days=${HISTORY_DAYS}`),
        ]);

        let history = lastHistory.current;
        let rawDeals = lastRawDeals.current;
        let rawOrders = lastRawOrders.current;

        if (historyRes.ok) {
          history = await historyRes.json();
          lastHistory.current = history;
        }
        if (dealsRes.ok) {
          rawDeals = await dealsRes.json();
          lastRawDeals.current = rawDeals;
        }
        if (ordersRes.ok) {
          rawOrders = await ordersRes.json();
          lastRawOrders.current = rawOrders;
        }

        setState(prev => ({ ...prev, history, rawDeals, rawOrders }));
      } catch {
        // Keep last known data
      }

      scheduleSlow();
    }
```

- [ ] **Step 5: Update `init()` to also fetch raw deals and orders**

In the `init` function, update the `Promise.all` from:

```typescript
        const [healthRes, accountRes, positionsRes, historyRes] = await Promise.all([
          fetch(`/api/live/health?${q}`, { signal }),
          fetch(`/api/live/account?${q}`, { signal }),
          fetch(`/api/live/positions?${q}`, { signal }),
          fetch(`/api/live/history?${q}&days=${HISTORY_DAYS}`, { signal }),
        ]);
```

To:

```typescript
        const [healthRes, accountRes, positionsRes, historyRes, dealsRes, ordersRes] = await Promise.all([
          fetch(`/api/live/health?${q}`, { signal }),
          fetch(`/api/live/account?${q}`, { signal }),
          fetch(`/api/live/positions?${q}`, { signal }),
          fetch(`/api/live/history?${q}&days=${HISTORY_DAYS}`, { signal }),
          fetch(`/api/live/raw-deals?${q}&days=${HISTORY_DAYS}`, { signal }),
          fetch(`/api/live/raw-orders?${q}&days=${HISTORY_DAYS}`, { signal }),
        ]);
```

Then after the existing history parsing block, add:

```typescript
        let rawDeals = lastRawDeals.current;
        let rawOrders = lastRawOrders.current;
        if (dealsRes.ok) {
          rawDeals = await dealsRes.json();
          lastRawDeals.current = rawDeals;
        }
        if (ordersRes.ok) {
          rawOrders = await ordersRes.json();
          lastRawOrders.current = rawOrders;
        }
```

And update the `setState` call to include the new fields:

```typescript
        setState({
          status: isOnline ? 'online' : 'offline',
          account,
          positions,
          history,
          rawDeals,
          rawOrders,
          lastUpdated: new Date(),
          error: isOnline ? null : 'MT5 disconnected',
        });
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/hooks/useLiveData.ts
git commit -m "feat: poll raw deals and orders in useLiveData hook"
```

---

### Task 10: Add Orders & Deals Tab — LiveTabs and Tab Component

**Files:**
- Modify: `app/components/live/LiveTabs.tsx`
- Create: `app/components/live/OrdersDealsTab.tsx`

- [ ] **Step 1: Update LiveTabs.tsx — add `orders-deals` tab**

Change the TabId type:

```typescript
export type TabId = 'overview' | 'objectives' | 'trades' | 'calendar' | 'performance';
```

To:

```typescript
export type TabId = 'overview' | 'objectives' | 'trades' | 'orders-deals' | 'calendar' | 'performance';
```

Add the new tab to the `tabs` array. Change:

```typescript
  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(showObjectives ? [{ id: 'objectives' as TabId, label: 'Objectives' }] : []),
    { id: 'trades', label: 'Trades' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'performance', label: 'Performance' },
  ];
```

To:

```typescript
  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(showObjectives ? [{ id: 'objectives' as TabId, label: 'Objectives' }] : []),
    { id: 'trades', label: 'Trades' },
    { id: 'orders-deals', label: 'Orders & Deals' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'performance', label: 'Performance' },
  ];
```

- [ ] **Step 2: Create `app/components/live/OrdersDealsTab.tsx`**

```tsx
'use client';

import { useState, useMemo } from 'react';
import { RawDeal, RawOrder, DisplayMode } from '../../lib/live-types';
import { formatValue } from '../../lib/trade-stats';
import { formatDateTime } from '../../lib/format-datetime';
import { useSettings } from '../../lib/settings-context';
import DataTable, { Column } from '../shared/DataTable';

interface OrdersDealsTabProps {
  rawDeals: RawDeal[];
  rawOrders: RawOrder[];
  balance: number;
  displayMode: DisplayMode;
}

type FilterKind = 'all' | 'deals' | 'orders';

type ActivityRow =
  | { kind: 'deal'; time: string; data: RawDeal }
  | { kind: 'order'; time: string; data: RawOrder };

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

export default function OrdersDealsTab({ rawDeals, rawOrders, balance, displayMode }: OrdersDealsTabProps) {
  const [filterKind, setFilterKind] = useState<FilterKind>('all');
  const [filterSymbol, setFilterSymbol] = useState<string>('all');
  const { timezone } = useSettings();

  const startingCapital = useMemo(() => {
    const totalPnl = rawDeals
      .filter(d => d.entry === 'out')
      .reduce((sum, d) => sum + d.profit + d.commission + d.swap, 0);
    return balance - totalPnl;
  }, [rawDeals, balance]);

  // Merge deals and orders into a single chronological list
  const merged = useMemo(() => {
    const items: ActivityRow[] = [];

    for (const deal of rawDeals) {
      items.push({ kind: 'deal', time: deal.time, data: deal });
    }
    for (const order of rawOrders) {
      items.push({ kind: 'order', time: order.time_setup, data: order });
    }

    items.sort((a, b) => b.time.localeCompare(a.time)); // newest first
    return items;
  }, [rawDeals, rawOrders]);

  // Available symbols for filter
  const symbols = useMemo(() => {
    const set = new Set<string>();
    for (const item of merged) {
      const sym = item.kind === 'deal' ? item.data.symbol : item.data.symbol;
      if (sym) set.add(sym);
    }
    return Array.from(set).sort();
  }, [merged]);

  // Apply filters
  const filtered = useMemo(() => {
    let items = merged;
    if (filterKind === 'deals') items = items.filter(i => i.kind === 'deal');
    if (filterKind === 'orders') items = items.filter(i => i.kind === 'order');
    if (filterSymbol !== 'all') {
      items = items.filter(i => {
        const sym = i.kind === 'deal' ? i.data.symbol : i.data.symbol;
        return sym === filterSymbol;
      });
    }
    return items;
  }, [merged, filterKind, filterSymbol]);

  const columns: Column<ActivityRow>[] = [
    {
      key: 'time', label: 'Time',
      render: (row) => (
        <span className="text-text-muted text-xs">{formatDateTime(row.time, timezone)}</span>
      ),
      sortable: true, sortValue: (row) => row.time,
    },
    {
      key: 'kind', label: 'Kind',
      render: (row) => (
        row.kind === 'deal'
          ? <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1e3a5f] text-[#60a5fa]">DEAL</span>
          : <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#2d1f4e] text-[#a78bfa]">ORDER</span>
      ),
      sortable: true, sortValue: (row) => row.kind,
    },
    {
      key: 'symbol', label: 'Symbol',
      render: (row) => {
        const sym = row.kind === 'deal' ? row.data.symbol : row.data.symbol;
        return sym
          ? <span className="text-text-primary font-medium font-mono">{sym}</span>
          : <span className="text-text-muted">—</span>;
      },
      sortable: true, sortValue: (row) => row.kind === 'deal' ? row.data.symbol : row.data.symbol,
    },
    {
      key: 'type', label: 'Type',
      render: (row) => {
        if (row.kind === 'deal') {
          const deal = row.data as RawDeal;
          const isNonTrading = !['buy', 'sell'].includes(deal.type);
          if (isNonTrading) {
            return <span className="px-2 py-0.5 rounded text-[11px] bg-warning/15 text-warning">{deal.type.toUpperCase()}</span>;
          }
          return (
            <span className={`px-2 py-0.5 rounded text-[11px] ${
              deal.type === 'buy' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
            }`}>
              {deal.type.toUpperCase()}
            </span>
          );
        }
        const order = row.data as RawOrder;
        const isBuy = order.type.startsWith('buy');
        return (
          <span className={`px-2 py-0.5 rounded text-[11px] ${
            isBuy ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
          }`}>
            {order.type.toUpperCase().replace('_', ' ')}
          </span>
        );
      },
      sortable: true,
      sortValue: (row) => row.kind === 'deal' ? (row.data as RawDeal).type : (row.data as RawOrder).type,
    },
    {
      key: 'entry', label: 'Entry',
      render: (row) => {
        if (row.kind === 'deal') {
          const deal = row.data as RawDeal;
          const colorMap: Record<string, string> = {
            'in': 'text-[#60a5fa]',
            'out': 'text-loss',
            'reverse': 'text-warning',
          };
          return <span className={`text-xs font-medium ${colorMap[deal.entry] ?? 'text-text-muted'}`}>
            {deal.entry ? deal.entry.toUpperCase() : '—'}
          </span>;
        }
        const order = row.data as RawOrder;
        const colorMap: Record<string, string> = {
          'filled': 'text-profit',
          'canceled': 'text-warning',
          'expired': 'text-text-muted',
          'rejected': 'text-text-muted',
          'placed': 'text-[#60a5fa]',
        };
        return <span className={`text-xs font-medium ${colorMap[order.state] ?? 'text-text-muted'}`}>
          {order.state.toUpperCase()}
        </span>;
      },
      sortable: true,
      sortValue: (row) => row.kind === 'deal' ? (row.data as RawDeal).entry : (row.data as RawOrder).state,
    },
    {
      key: 'volume', label: 'Volume', align: 'right',
      render: (row) => {
        const vol = row.kind === 'deal'
          ? (row.data as RawDeal).volume
          : (row.data as RawOrder).volume_initial;
        return vol > 0
          ? <span className="text-text-secondary">{vol.toFixed(2)}</span>
          : <span className="text-text-muted">—</span>;
      },
      sortable: true,
      sortValue: (row) => row.kind === 'deal' ? (row.data as RawDeal).volume : (row.data as RawOrder).volume_initial,
    },
    {
      key: 'price', label: 'Price', align: 'right',
      render: (row) => {
        const price = row.kind === 'deal'
          ? (row.data as RawDeal).price
          : (row.data as RawOrder).price;
        return price > 0
          ? <span className="text-text-secondary">{price.toFixed(5)}</span>
          : <span className="text-text-muted">—</span>;
      },
    },
    {
      key: 'profit', label: 'Profit', align: 'right',
      render: (row) => {
        if (row.kind === 'order') return <span className="text-text-muted">—</span>;
        const deal = row.data as RawDeal;
        // Show profit for exit deals and balance operations
        if (deal.entry === 'in') return <span className="text-text-muted">—</span>;
        const val = deal.profit;
        if (val === 0 && deal.entry === '') {
          // Non-trading deal with profit (e.g., balance deposit)
          return <span className="text-profit">{formatCurrency(deal.profit)}</span>;
        }
        return <span className={`font-semibold ${val >= 0 ? 'text-profit' : 'text-loss'}`}>
          {formatCurrency(val)}
        </span>;
      },
      sortable: true,
      sortValue: (row) => row.kind === 'deal' ? (row.data as RawDeal).profit : 0,
    },
    {
      key: 'comment', label: 'Comment',
      render: (row) => {
        if (row.kind === 'order') {
          const order = row.data as RawOrder;
          const parts: string[] = [];
          if (order.sl) parts.push(`SL: ${order.sl.toFixed(5)}`);
          if (order.tp) parts.push(`TP: ${order.tp.toFixed(5)}`);
          if (order.comment) parts.push(order.comment);
          return <span className="text-text-muted text-xs">{parts.join(' ')}</span>;
        }
        const deal = row.data as RawDeal;
        return <span className="text-text-muted text-xs">{deal.comment}</span>;
      },
    },
  ];

  if (rawDeals.length === 0 && rawOrders.length === 0) {
    return <div className="py-16 text-center text-text-muted text-sm">No orders or deals yet</div>;
  }

  return (
    <div className="space-y-0 pt-6">
      <div className="bg-bg-secondary border border-border border-b-0 rounded-t-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(['all', 'deals', 'orders'] as const).map(kind => (
              <button
                key={kind}
                onClick={() => setFilterKind(kind)}
                className={`px-3 py-1.5 text-xs uppercase font-medium transition-colors ${
                  filterKind === kind
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
                }`}
              >
                {kind}
              </button>
            ))}
          </div>
          <span className="text-xs text-text-muted font-mono">{filtered.length} items</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="text-xs bg-bg-tertiary border border-border rounded-lg px-3 py-1.5 text-text-secondary"
          >
            <option value="all">Symbol: All</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="[&>div]:rounded-t-none [&>div]:border-t-0">
        <DataTable
          columns={columns}
          data={filtered}
          sortable={true}
          pagination={true}
          pageSize={25}
          emptyMessage="No items match this filter"
          rowKey={(row) => `${row.kind}-${row.kind === 'deal' ? (row.data as RawDeal).ticket : (row.data as RawOrder).ticket}`}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds (page.tsx may have warnings about missing tab wiring — fixed next task).

- [ ] **Step 4: Commit**

```bash
git add app/components/live/LiveTabs.tsx app/components/live/OrdersDealsTab.tsx
git commit -m "feat: add Orders & Deals tab with combined chronological view"
```

---

### Task 11: Wire Up Orders & Deals Tab in Live Page

**Files:**
- Modify: `app/live/page.tsx`

- [ ] **Step 1: Add import for OrdersDealsTab**

Add after the existing tab imports:

```typescript
import OrdersDealsTab from '../components/live/OrdersDealsTab';
```

- [ ] **Step 2: Update `getInitialTab()` to recognize `orders-deals`**

Change the hash validation:

```typescript
  if (['overview', 'objectives', 'trades', 'calendar', 'performance'].includes(hash)) return hash as TabId;
```

To:

```typescript
  if (['overview', 'objectives', 'trades', 'orders-deals', 'calendar', 'performance'].includes(hash)) return hash as TabId;
```

- [ ] **Step 3: Add the OrdersDealsTab rendering block**

After the TradesTab rendering block:

```typescript
      {activeTab === 'trades' && liveData.account && (
        <TradesTab trades={liveData.history} balance={liveData.account.balance} displayMode={displayMode} />
      )}
```

Add:

```typescript
      {activeTab === 'orders-deals' && liveData.account && (
        <OrdersDealsTab
          rawDeals={liveData.rawDeals}
          rawOrders={liveData.rawOrders}
          balance={liveData.account.balance}
          displayMode={displayMode}
        />
      )}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/live/page.tsx
git commit -m "feat: wire Orders & Deals tab into live page"
```

---

### Task 12: Add Timezone Picker to Settings Page

**Files:**
- Modify: `app/live/settings/page.tsx`

- [ ] **Step 1: Add import for useSettings**

Add at the top of the file:

```typescript
import { useSettings } from '../../lib/settings-context';
```

- [ ] **Step 2: Add timezone state and hook inside the component**

Inside the `SettingsPage` component function, after existing state declarations, add:

```typescript
  const { timezone, setTimezone } = useSettings();
  const [tzSearch, setTzSearch] = useState('');
  const [tzDropdownOpen, setTzDropdownOpen] = useState(false);
```

Add the `useState` import if not already present (it is — line 3).

- [ ] **Step 3: Add timezone list and filtered results**

Add after the state declarations:

```typescript
  const allTimezones = useMemo(() => Intl.supportedValuesOf('timeZone'), []);

  const filteredTimezones = useMemo(() => {
    if (!tzSearch) return allTimezones;
    const lower = tzSearch.toLowerCase();
    return allTimezones.filter(tz => tz.toLowerCase().includes(lower));
  }, [allTimezones, tzSearch]);
```

Add `useMemo` to the import from `react` if not already there. Looking at the existing imports, line 3 has `useState, useEffect, useCallback` — add `useMemo`:

```typescript
import { useState, useEffect, useCallback, useMemo } from 'react';
```

- [ ] **Step 4: Add the timezone section UI**

Find the existing settings page JSX. Add a timezone section before the accounts section. After the page header (the `<h1>Settings</h1>` or similar heading element) and before the accounts section, add:

```tsx
        {/* Timezone */}
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Timezone</h2>
          <p className="text-sm text-text-muted mb-4">
            All timestamps across the app will be displayed in the selected timezone.
          </p>
          <div className="relative max-w-sm">
            <input
              type="text"
              value={tzDropdownOpen ? tzSearch : timezone}
              onChange={(e) => { setTzSearch(e.target.value); setTzDropdownOpen(true); }}
              onFocus={() => { setTzDropdownOpen(true); setTzSearch(''); }}
              onBlur={() => setTimeout(() => setTzDropdownOpen(false), 200)}
              placeholder="Search timezones..."
              className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {tzDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-bg-secondary border border-border rounded-lg shadow-lg">
                {filteredTimezones.slice(0, 50).map(tz => (
                  <button
                    key={tz}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setTimezone(tz);
                      setTzSearch('');
                      setTzDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-tertiary transition-colors ${
                      tz === timezone ? 'text-accent font-medium' : 'text-text-secondary'
                    }`}
                  >
                    {tz}
                  </button>
                ))}
                {filteredTimezones.length === 0 && (
                  <div className="px-3 py-2 text-sm text-text-muted">No timezones found</div>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-text-muted mt-2">
            Currently: <span className="font-mono text-text-secondary">{timezone}</span>
          </p>
        </div>
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/live/settings/page.tsx
git commit -m "feat: add timezone picker to settings page"
```

---

### Task 13: Final Verification

- [ ] **Step 1: Run a full build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Start dev server and manually verify**

```bash
npm run dev
```

Verify in the browser:
1. Trades tab now shows Open Time and Close Time columns in 12-hour format
2. Orders & Deals tab appears and shows combined deal/order data
3. Filter buttons (ALL/DEALS/ORDERS) work
4. Symbol dropdown filter works
5. Settings page shows timezone picker
6. Changing timezone updates all timestamps across tabs
7. Calendar tab groups trades correctly when timezone shifts dates

- [ ] **Step 3: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address any issues found during verification"
```
