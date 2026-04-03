# Orders & Deals Tab, Trades Tab Updates, and Timezone System

**Date:** 2026-04-04
**Status:** Draft

## Overview

Three changes to the live trading journal:

1. **Orders & Deals tab** — new tab showing all raw deals and orders in a single chronological view
2. **Trades tab** — add Open Time column alongside existing Close Time
3. **Timezone system** — global IANA timezone setting with 12-hour time format across the app

---

## 1. Data Layer — New API Endpoints

### Flask Bridge (`vps-bridge/mt5_api.py`)

**`GET /raw-deals?days=90`**

Returns all historical deals from `mt5.history_deals_get()` without pairing. Each deal is returned as-is.

Fields per deal:
- `ticket` (number) — deal ticket
- `position_id` (number) — links to position
- `symbol` (string)
- `type` (string) — `"buy"`, `"sell"`, `"balance"`, `"credit"`, `"charge"`, `"correction"`
- `entry` (string) — `"in"`, `"out"`, `"reverse"`, `""` (empty for non-trading deals)
- `volume` (number)
- `price` (number)
- `profit` (number)
- `commission` (number)
- `swap` (number)
- `time` (string) — ISO 8601 UTC
- `comment` (string)
- `magic` (number)

**`GET /raw-orders?days=90`**

Returns all historical orders from `mt5.history_orders_get()`.

Fields per order:
- `ticket` (number) — order ticket
- `position_id` (number)
- `symbol` (string)
- `type` (string) — `"buy"`, `"sell"`, `"buy_limit"`, `"sell_limit"`, `"buy_stop"`, `"sell_stop"`, `"buy_stop_limit"`, `"sell_stop_limit"`
- `volume_initial` (number)
- `volume_current` (number)
- `price` (number)
- `sl` (number | null)
- `tp` (number | null)
- `state` (string) — `"filled"`, `"canceled"`, `"expired"`, `"placed"`, `"rejected"`
- `time_setup` (string) — ISO 8601 UTC
- `time_done` (string) — ISO 8601 UTC
- `comment` (string)
- `magic` (number)

### Next.js Proxy Routes

- `GET /api/live/raw-deals?accountId=X&days=Y` — proxies to Flask bridge `/raw-deals`
- `GET /api/live/raw-orders?accountId=X&days=Y` — proxies to Flask bridge `/raw-orders`

Same pattern as existing `/api/live/history/route.ts`.

### TypeScript Types (`app/lib/live-types.ts`)

New interfaces: `RawDeal` and `RawOrder` matching the field definitions above.

### Data Fetching (`useLiveData` hook)

Add both `/raw-deals` and `/raw-orders` to the slow polling interval (60s), alongside existing history. Expose as `rawDeals: RawDeal[]` and `rawOrders: RawOrder[]`.

---

## 2. Orders & Deals Tab

New tab added after "Trades" in the tab bar: **Overview | Objectives | Trades | Orders & Deals | Calendar | Performance**

### Filter Bar

- Type filter toggle: **ALL** (default) | **DEALS** | **ORDERS**
- Item count display (e.g., "24 items")
- Symbol dropdown filter (optional, defaults to "All")

### Table Columns

| Column | Source (Deal) | Source (Order) |
|--------|--------------|----------------|
| Time | `deal.time` | `order.time_setup` |
| Kind | Badge: "DEAL" (blue) | Badge: "ORDER" (purple) |
| Symbol | `deal.symbol` (or "—" for non-trading) | `order.symbol` |
| Type | BUY/SELL/BALANCE/CREDIT badge | BUY/SELL/BUY_LIMIT/etc. |
| Entry | IN/OUT/REVERSE (deal entry) | FILLED/CANCELED/EXPIRED/REJECTED (order state) |
| Volume | `deal.volume` | `order.volume_initial` |
| Price | `deal.price` | `order.price` |
| Profit | `deal.profit` (or "—" for entries/non-trading) | "—" |
| Comment | `deal.comment` | SL/TP values + `order.comment` |

### Behavior

- Merged chronologically (newest first) from both `rawDeals` and `rawOrders`
- Sortable columns, pagination (25 rows per page) — same as Trades tab
- Kind badge colors: Deal = blue (`#1e3a5f`/`#60a5fa`), Order = purple (`#2d1f4e`/`#a78bfa`)
- Entry column color-coded: IN = blue, OUT = red, FILLED = green, CANCELED = yellow, EXPIRED/REJECTED = muted
- Non-trading deal types (balance, credit, etc.) shown with yellow badge

### Tab Registration

Add `'orders-deals'` to the `TabId` type union in `LiveTabs.tsx`. The tab is always visible (not conditional like Objectives).

---

## 3. Trades Tab — Open Time Column

Add **Open Time** as the first column, shift **Close Time** to the second column. Both use `trade.open_time` and `trade.close_time` respectively (both already available on `LiveTrade` interface).

Column order becomes: **Open Time | Close Time | Symbol | Type | Volume | Open Price | Close Price | Profit | Balance**

---

## 4. Timezone System

### Database

Add an `app_settings` table:

```sql
CREATE TABLE app_settings (
  setting_key VARCHAR(50) PRIMARY KEY,
  setting_value TEXT NOT NULL
);

INSERT INTO app_settings (setting_key, setting_value) VALUES ('timezone', 'UTC');
```

### API Routes

New top-level routes (not under `/api/live/`):

- `GET /api/settings` — returns all settings as a key-value object
- `PUT /api/settings` — updates one or more settings

### Settings Page (`/live/settings`)

Add a timezone section with a searchable dropdown of all IANA timezones. User can type to filter (e.g., "Manila" finds `Asia/Manila`, "New York" finds `America/New_York`).

### Client-Side Time Formatting

**Shared utility:** A single `formatDateTime(isoString: string)` function that:
1. Reads the selected timezone from a React context (`SettingsContext`)
2. Converts the UTC ISO string to the target timezone using `date-fns-tz`
3. Formats as `yyyy/MM/dd h:mm:ss a` (12-hour with AM/PM)

**Context provider:** `SettingsProvider` wraps the app, fetches settings from `/api/settings` on mount, and provides `timezone` to all components.

**All time displays use this utility:**
- Trades tab (Open Time, Close Time)
- Orders & Deals tab (Time column)
- Calendar tab (date grouping and tooltips)
- Overview tab (any time references)

**Date grouping respects timezone:** Calendar and Performance tabs group trades by date. When a timezone is set, the date boundary shifts accordingly. A trade at UTC 11:30 PM on April 3 appears on April 4 in `Asia/Manila`. The `groupByDay()` and `groupByMonth()` utilities in `trade-stats.ts` must accept the timezone and convert before grouping.

### 12-Hour Format

System-wide change. The `formatDateTime` utility always outputs 12-hour format with AM/PM. This is not a setting — it's the default format.

**Example conversions:**
- UTC `2026-04-03T23:30:01Z` with `Asia/Manila`: `2026/04/04 7:30:01 AM`
- UTC `2026-04-03T23:30:01Z` with `UTC`: `2026/04/03 11:30:01 PM`

### Dependencies

Add `date-fns-tz` package for timezone conversion. The project already uses `date-fns`.

---

## Technical Notes

- All timestamps remain UTC in the API and database — timezone conversion is purely a client-side display concern
- The Flask bridge returns ISO 8601 UTC strings for all time fields
- MT5 deal type mapping: 0=buy, 1=sell, 2+=non-trading (balance, credit, charge, correction, etc.)
- MT5 deal entry mapping: 0=in, 1=out, 2=reverse
- MT5 order state mapping: 0=started, 1=placed, 2=canceled, 3=partial, 4=filled, 5=rejected, 6=expired
