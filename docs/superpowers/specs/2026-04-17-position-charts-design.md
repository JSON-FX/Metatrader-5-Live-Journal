# Position Charts — Design Spec

## Overview

Render an interactive candlestick chart for any live position or closed trade. The chart shows the instrument's OHLC data centered on the trade's time window, with a "trade box" overlay that visually plots risk (SL rectangle) and reward (TP rectangle) out to the right edge of the chart, an entry-to-current connector line, and right-edge labels for TP / P&L / SL. Charts open in a modal drilled down from a row click in the Open Positions table or the closed-trades Trades tab.

The feature is additive: no existing behavior changes, no migrations, one new bridge endpoint, one new Next.js proxy, three new React units.

## Scope

**In scope (v1):**
- Chart for any open position (from the live Open Positions table).
- Chart for any closed trade (from the Trades tab on the live page).
- Auto-picked timeframe based on trade duration.
- Live updates for open positions driven by the existing poll cadence.
- Trade box overlay (reward + risk rectangles, P&L band, entry→current connector, right-edge labels).

**Out of scope (deferred):**
- Backtest trade charts (different data source; symbol mapping concerns).
- User-switchable timeframes (auto-pick covers the journal use case).
- Multi-position overview charts / small multiples.
- Drawing tools, indicators, volume profile.
- Persistent candle cache (Approach 1 — thin pass-through — is the chosen architecture).

## Architecture

```
┌─ CLIENT ─────────────────────────────────────────────────────────────┐
│                                                                      │
│   OpenPositionsTable ──┐                                             │
│                        ├──► row click ──► <PositionChartModal/>      │
│   TradesTab ───────────┘                          │                  │
│                                                   ▼                  │
│                                         ┌───────────────────────┐    │
│                                         │ usePositionChart()    │    │
│                                         │  - picks timeframe    │    │
│                                         │  - computes window    │    │
│                                         │  - fetches /rates     │    │
│                                         │  - live updates for   │    │
│                                         │    open positions     │    │
│                                         └──────────┬────────────┘    │
│                                                    │                 │
│                                         ┌──────────▼────────────┐    │
│                                         │ <PositionChart/>      │    │
│                                         │  lightweight-charts + │    │
│                                         │  TradeBoxPrimitive    │    │
│                                         └───────────────────────┘    │
└──────────────────────────────────────────┬───────────────────────────┘
                                           │
                                     GET /api/live/rates
                                           │
┌──────────────────────────────────────────▼───────────────────────────┐
│  NEXT.JS SERVER                                                      │
│    app/api/live/rates/route.ts  (thin proxy; same shape as existing  │
│                                  positions/route.ts)                 │
└──────────────────────────────────────────┬───────────────────────────┘
                                           │
                                 GET <bridge>/rates?symbol=&timeframe=&from=&to=
                                           │
┌──────────────────────────────────────────▼───────────────────────────┐
│  MT5 VPS BRIDGE (Python / Flask)                                     │
│    GET /rates  —  mt5.copy_rates_range + GMT-offset correction       │
└──────────────────────────────────────────────────────────────────────┘
```

**Data-layer policy — Approach 1: thin pass-through, no cache.** Every modal open fetches from the bridge. The Next.js route is a dumb proxy. Live updates for open positions refetch only the latest bar via the same endpoint. Rationale: one user, fast bridge, closed-trade data is idempotent, lightweight-charts holds rendered state client-side during modal lifetime. Cache becomes worth building when measured to be a bottleneck.

## Units and boundaries

| Unit | Inputs | Outputs | Depends on |
|---|---|---|---|
| `pickTimeframe` (pure) | duration (ms) | `Timeframe` | — |
| `computeWindow` (pure) | openTs, closeTs, timeframe | `{from, to}` | — |
| `usePositionChart` (hook) | `PositionLike`, accountId | `{bars, status, timeframe, window, error?}` | fetch, `useLiveData` (open only) |
| `PositionChart` (component) | bars, overlays, timeframe, theme | canvas render | lightweight-charts |
| `TradeBoxPrimitive` (class) | box geometry + colors | canvas paint | lightweight-charts primitive API |
| `PositionChartModal` (component) | position or trade, accountId, open/onClose | modal tree | hook, chart, `Modal` |

Each unit has one responsibility. The chart component is pure render (easy to reuse for backtest charts later). The hook owns policy (timeframe selection, windowing, polling). The primitive is self-contained and re-used identically for open vs. closed trades.

## Bridge `/rates` endpoint

**Status:** Already implemented in [vps-bridge/mt5_api.py](../../../vps-bridge/mt5_api.py), validated end-to-end against a real closed trade. This section documents the final behavior.

**Request:**
```
GET /rates?symbol=EURUSD&timeframe=M5&from=1713302400&to=1713324000
```

| Param | Type | Notes |
|---|---|---|
| `symbol` | string | Exact MT5 symbol (`EURUSD`, `XAUUSD`, etc.). No translation. |
| `timeframe` | string | One of `M1`, `M5`, `M15`, `H1`, `H4`, `D1`. |
| `from` | int | UTC unix seconds, inclusive. |
| `to` | int | UTC unix seconds, inclusive. |

**Response (200):**
```json
{
  "symbol": "EURUSD",
  "timeframe": "M5",
  "bars": [
    { "time": 1713302400, "open": 1.0651, "high": 1.0654, "low": 1.0649, "close": 1.0652 }
  ]
}
```

- `time` is bar open time in UTC unix seconds — matches lightweight-charts' expected format directly.
- Volume is omitted; not needed for position overlays.

**Errors:**
- `400` — missing/invalid params, unknown timeframe, `from >= to`
- `404` — symbol not in `mt5.symbols_get()`
- `503` — MT5 not connected

**Bounds:** server-side cap of 2000 bars returned. Our padded windows at the chosen timeframes never approach this ceiling.

**Timezone handling — critical detail:** `mt5.copy_rates_range` treats input datetimes as UTC-aware but returns bar `time` in **broker-local wall-clock as unix seconds** (not UTC, despite what MQL5 docs imply). The bridge subtracts the detected broker GMT offset on output to yield true UTC. This was verified empirically: with the correction, reported fill prices from `/history` fall inside the OHLC range of the bars at the reported fill times. Without the correction, fills are offset by the broker GMT hours. This mirrors the existing `broker_ts_to_utc` treatment used by `/history` and `/positions`.

## Next.js `/api/live/rates` proxy

**Status:** Already implemented in [app/api/live/rates/route.ts](../../../app/api/live/rates/route.ts).

Thin pass-through mirroring [app/api/live/positions/route.ts](../../../app/api/live/positions/route.ts). Resolves `accountId` → bridge endpoint via `resolveEndpoint`, forwards query params, returns bridge response or translated error. Timeout 8s (vs. 5s on positions — wider window can take longer on the MT5 side).

**Types — added to [app/lib/live-types.ts](../../../app/lib/live-types.ts):**

```ts
export type Timeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

export interface CandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface RatesResponse {
  symbol: string;
  timeframe: Timeframe;
  bars: CandleBar[];
}
```

## Timeframe selection (`pickTimeframe`)

Pure function mapping trade duration to timeframe. The rule:

| Duration | Timeframe |
|---|---|
| `< 1h` | `M1` |
| `< 4h` | `M5` |
| `< 1d` | `M15` |
| `< 1w` | `H1` |
| `≥ 1w` | `D1` |

For open positions the "duration" is `now - open_time`. Timeframe is recalculated on each render of the hook — cheap, and means a trade that crosses a boundary while watched smoothly upgrades. Data in cache from a prior timeframe is discarded; a fresh `/rates` call goes out. (Rare; acceptable.)

Exactly one caller (`usePositionChart`). Unit-testable.

## Window computation (`computeWindow`)

Pure function returning `{ from, to }` unix seconds such that the trade occupies the middle ~60% of the chart, with 20% padding before `openTime` and 20% after `closeTime` (or `now` for open positions):

```
pad = (closeTime - openTime) * 0.2
from = openTime - pad
to   = closeTime + pad
```

Minimum padding: clamp `pad >= 10 * timeframe_seconds` so that a 30-second scalp still gets at least 10 bars of context on each side (otherwise pad = 6s and the chart looks clipped).

Exactly one caller. Unit-testable.

## `usePositionChart` hook

**File:** `app/hooks/usePositionChart.ts`

**Input type** — discriminated union so open vs. closed differences are type-checked:

```ts
type PositionLike =
  | { kind: 'open';   position: LivePosition; currentPrice: number }
  | { kind: 'closed'; trade: LiveTrade };

function usePositionChart(input: PositionLike, accountId: string): {
  status: 'loading' | 'ready' | 'error';
  bars:   CandleBar[];
  timeframe: Timeframe;
  window: { from: number; to: number };
  error?: string;
  retry: () => void;
}
```

**Behavior:**

1. Derives `openTime`, `closeTime` (or `now`), `symbol` from the discriminated input.
2. Runs `pickTimeframe` and `computeWindow` to derive the `Timeframe` and `{from, to}`.
3. On mount (and on `retry()`): `AbortController`-guarded `GET /api/live/rates?accountId&symbol&timeframe&from&to`. Sets `status: 'ready'` and populates `bars` on success, `status: 'error'` with translated message on failure.
4. **Open positions only:** subscribes to the existing `useLiveData` polling cadence. On each poll tick, refetches a minimal trailing window `from = lastBar.time, to = now` and merges: replace `bars[-1]` if the first returned bar's `time` matches, else append.
5. Aborts in-flight fetch on unmount or when any dep changes.

**Open-position polling resilience:**
- Transient fetch failure during live-update → silent retry on next poll.
- Three consecutive failures → set an `isStale` flag (addition to return shape; surfaced by the modal as a small "Live updates paused" badge). Clears on next successful fetch.
- Initial-load failure is the "error" state; polling does not start until the first fetch succeeds.

## `PositionChart` component

**File:** `app/components/live/PositionChart.tsx`

**Props:**

```ts
interface PositionChartProps {
  bars: CandleBar[];
  timeframe: Timeframe;
  overlays: PositionOverlays;
  height?: number;              // default 420
  theme: 'light' | 'dark';
}
```

**Responsibilities:**

1. On mount: create an `IChartApi` on a ref'd `<div>`, add a candlestick series, call `series.setData(bars)`.
2. Instantiate a single `TradeBoxPrimitive` and attach it to the candlestick series via `series.attachPrimitive(primitive)` (v5 `ISeriesPrimitive` API).
3. Read CSS custom properties (`--color-profit`, `--color-loss`, `--color-text-muted`, `--color-text-primary`, `--color-bg-secondary`) once at mount via `getComputedStyle(document.documentElement)`; feed them to the chart layout options and the primitive.
4. On `bars` prop change: if only the last bar is new/updated (same length, same head), call `series.update(lastBar)`; else `series.setData(bars)`.
5. On `overlays` prop change: `primitive.update(overlays)`; it recomputes its geometry without being recreated.
6. On `theme` change: re-read CSS vars, `chart.applyOptions({ layout: ... })`, `primitive.setColors(...)`.
7. Cleanup: `chart.remove()` in effect cleanup.

**Explicitly NOT in this component:** no data fetching, no timeframe logic, no awareness of `LivePosition`/`LiveTrade` types. This keeps it reusable for backtest charting later and small enough to hold in context during edits.

**`PositionOverlays` shape** (consumed by `PositionChart`; built by `PositionChartModal` from either a `LivePosition` or `LiveTrade`):

```ts
interface PositionOverlays {
  side: 'buy' | 'sell';
  openTime:   number;            // UTC unix seconds
  openPrice:  number;
  closeTime?: number;            // undefined for open positions
  closePrice?: number;           //  "
  currentPrice?: number;         // open positions; drives P&L band + connector
  sl: number | null;
  tp: number | null;
  profit: number;
  symbol: string;                // for pip-distance computation
}
```

## `TradeBoxPrimitive`

**File:** `app/components/live/TradeBoxPrimitive.ts`

A self-contained class implementing `ISeriesPrimitive` (no React), attached to the candlestick series. Adapted from the lightweight-charts `rectangle-drawing-tool` plugin example. One instance per chart; updated in place on overlay/theme changes.

**Renders, in z-order from back to front:**

1. **Reward box** — rectangle spanning `[openTime, chart right edge] × [openPrice, tp]`, fill = profit color at ~12% alpha, no border. Omitted if `tp === null`.
2. **Risk box** — rectangle spanning `[openTime, chart right edge] × [sl, openPrice]`, fill = loss color at ~12% alpha, no border. Omitted if `sl === null`.
3. **P&L band** — a thin horizontal band within the winning-side box, from `openPrice` to `currentPrice` (open) or `closePrice` (closed). Fill = same color as the enclosing box at an additional +10% alpha to darken. Gives the "travel into R:R" shading from the reference image.
4. **Entry → current connector** — dashed line from `(openTime, openPrice)` to `(closeTime or now, currentPrice or closePrice)`. Color = profit color if the trade is currently in profit, else loss color.
5. **Right-edge labels** — three label pills drawn against the right edge of each box:
   - `TP: {price} ({pips}p, ${reward_amount})` on the reward box
   - `P&L: {profit} ({pips}p)` in the middle, anchored to `currentPrice` / `closePrice`
   - `SL: {price} ({pips}p, ${risk_amount})` on the risk box
   - Amounts use the position's contract size × pip value (derived from `symbol` + `volume`). If pip-value computation isn't trivial, fall back to pips-only labels in v1.

**Box right edge for closed trades:** extends to chart right edge (matches the reference image; same visual for live and closed trades per the brainstorm decision).

**Update path:** `primitive.update({ overlays, colors })` stores the new geometry and calls `requestUpdate()` on the chart; the chart redraws on the next frame. No DOM churn, no canvas recreation per tick.

## `PositionChartModal` component

**File:** `app/components/live/PositionChartModal.tsx`

Composes hook + chart inside the existing `Modal`. Layout:

```
┌─ Modal header ──────────────────────────────────────┐
│ GBPUSD • Sell 0.09 • M15                         ×  │
├─ Subheader ─────────────────────────────────────────┤
│ Open 04-15 09:02 → Close 04-16 02:42                │
│ Duration 17h 40m • P/L: -$24.59                     │
├─ Chart area ────────────────────────────────────────┤
│                                                     │
│     <PositionChart bars={...} overlays={...} />     │
│                                                     │
│  (skeleton while hook.status==='loading')           │
│  (error panel with Retry while hook.status==='error')│
│  ("Live updates paused" badge if hook.isStale)      │
└─────────────────────────────────────────────────────┘
```

**Opens from:**
- [OpenPositionsTable](../../../app/components/live/OpenPositionsTable.tsx) row click — build `PositionLike.kind = 'open'` from the `LivePosition`; pass accountId from the current live-page context.
- [TradesTab](../../../app/components/live/TradesTab.tsx) row click — build `PositionLike.kind = 'closed'` from the `LiveTrade`.

Both callers are the only places that know about both trade types and the accountId at once.

**DataTable integration:** add `onRowClick` to [DataTable.tsx](../../../app/components/shared/DataTable.tsx) if not already present. Existing behavior (sort, pagination) unchanged. Row gains a subtle hover cursor to hint at clickability.

## Error & empty states

**Loading state:** modal chrome renders immediately; chart region shows a 420px-tall skeleton. No spinner inside the chart.

**Fetch errors**, rendered inline in the chart area with a Retry button:

| Failure | HTTP | Message |
|---|---|---|
| MT5 bridge offline | 503 | "MT5 bridge offline — can't load chart" |
| Symbol not on account | 404 | "Chart unavailable: symbol not found on this account" |
| Bad params | 400 | "Chart configuration error" |
| Other | — | "Couldn't load chart" |

**Empty bars:** `200 OK` with `bars: []` renders as `"No candle data for this range"`. No Retry button — the user would need to widen the window, which v1 doesn't expose.

**Open-position poll failures:** silent single-failure retry on next poll; three consecutive failures → small "Live updates paused" badge in chart top-right; clears on next success.

**Accepted limitations:**
- The most recent bar of an open-position chart is partial until the timeframe's bar boundary passes; `series.update()` handles this naturally.
- Broker GMT offset changes (e.g. DST) are reflected on the next fetch, not retroactively on already-rendered charts. Closing and reopening the modal is sufficient.
- Symbol rename on the broker side surfaces as 404. No special handling in v1.

## Testing approach

**Unit-testable, should have tests:**
- `pickTimeframe(durationMs)` — boundary cases at each threshold.
- `computeWindow(openTs, closeTs, timeframe)` — padding math, minimum padding clamp, open-position case (`closeTs = now`).

**Component/integration — manual verification in dev:**
- Open a chart for an in-profit live position → reward box shaded, P&L band extends above `openPrice`, connector rising.
- Open a chart for a losing live position → risk box shaded, band below `openPrice`, connector falling.
- Open a chart for a closed winner/loser → same visuals with static right-edge labels and no live updates.
- Trade without SL or TP → corresponding box simply not drawn.
- Hook's live-update path: observe last bar mutating on each poll cycle.
- Error states by temporarily pointing the Next.js proxy at a dead bridge port.

**Data plumbing already verified** (see commit `1d5301e`): 5-point check against a real closed GBPUSD trade passed — response shape, UTC round-trip, entry alignment, exit alignment, bar count.

## Implementation order

1. `pickTimeframe` + `computeWindow` + unit tests.
2. `TradeBoxPrimitive` class — stand-alone, testable visually in isolation.
3. `PositionChart` component — render path, no fetching; hand it bars + overlays directly for initial visual tuning.
4. `usePositionChart` hook — fetch for closed trades first (no polling).
5. `PositionChartModal` — wire modal chrome + hook + chart, closed-trade path first.
6. Wire row clicks in `TradesTab`.
7. Add live-update path to the hook for open positions.
8. Wire row clicks in `OpenPositionsTable`.
9. Empty/error state polish; stale-poll badge.

## Risks / open questions

- **lightweight-charts version** — currently not a dep. Install v5.x (Apache-2.0). Adds ~45KB gzipped to the live page bundle. Acceptable.
- **Attribution requirement** — Apache-2.0 license asks that "TradingView is credited as the product creator." The `attributionLogo` chart option handles this automatically; we'll enable it.
- **Pip-value computation for label amounts** — requires knowing contract size and quote currency. Forex majors are ~$10/pip per standard lot. XAUUSD, indices, exotics differ. If this gets hairy, v1 falls back to pips-only labels; amount is a follow-up.
- **DataTable onRowClick** — may or may not already support this; if not, it's a small addition but worth verifying before execution.
