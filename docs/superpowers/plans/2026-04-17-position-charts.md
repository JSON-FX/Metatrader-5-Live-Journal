# Position Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render an interactive candlestick chart in a modal drilled-down from any open position or closed trade row, with a "trade box" overlay showing risk/reward rectangles, P&L band, and entry→current/close connector — live-updating for open positions on the existing poll cadence.

**Architecture:** Data plumbing is already built and validated (bridge `/rates` + Next.js proxy + types, committed on this branch). This plan covers the client-side: two pure policy functions (`pickTimeframe`, `computeWindow`), a `usePositionChart` hook, a `PositionChart` component wrapping lightweight-charts, a self-contained `TradeBoxPrimitive` that implements `ISeriesPrimitive`, and a `PositionChartModal` that composes them. Wiring plumbs `onRowClick` through the existing `DataTable` and a `maxWidth` prop through the existing `Modal`.

**Tech Stack:** React 19 + Next.js 16, TypeScript, Tailwind v4, lightweight-charts v5 (Apache-2.0, ~45KB), Jest (to be added for the two pure functions).

Spec: [docs/superpowers/specs/2026-04-17-position-charts-design.md](../specs/2026-04-17-position-charts-design.md)
Branch: `feat/position-charts`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Add `lightweight-charts` dep + `jest` dev deps |
| `jest.config.mjs` | Create | Minimal Jest config for pure-function unit tests |
| `app/lib/chart-policy.ts` | Create | Pure functions: `pickTimeframe`, `computeWindow` |
| `app/lib/__tests__/chart-policy.test.ts` | Create | Unit tests for the two pure functions |
| `app/components/shared/Modal.tsx` | Modify | Add `maxWidth` prop so the chart modal can be wider |
| `app/components/shared/DataTable.tsx` | Modify | Add `onRowClick` prop + hover-pointer styling |
| `app/components/live/TradeBoxPrimitive.ts` | Create | `ISeriesPrimitive` drawing reward/risk boxes + P&L band + connector + labels |
| `app/components/live/PositionChart.tsx` | Create | Presentation-only chart: bars + overlays → canvas |
| `app/hooks/usePositionChart.ts` | Create | Fetch, poll (open only), timeframe/window policy |
| `app/components/live/PositionChartModal.tsx` | Create | Modal shell composing the hook + chart |
| `app/components/live/OpenPositionsTable.tsx` | Modify | Wire row click → open modal with `LivePosition` |
| `app/components/live/TradesTab.tsx` | Modify | Wire row click → open modal with `LiveTrade` |
| `app/live/page.tsx` | Modify | Pass `accountId` down to `TradesTab` (already in scope for the page) |

**Already committed on this branch** (see commits `1d5301e`, `8ec38a3`): `vps-bridge/mt5_api.py`, `app/api/live/rates/route.ts`, type additions to `app/lib/live-types.ts`.

---

## Task 1: Install dependencies and add Jest

**Files:**
- Modify: `package.json`
- Create: `jest.config.mjs`

- [ ] **Step 1: Install lightweight-charts runtime dep**

Run:
```bash
npm install lightweight-charts@^5.0.0
```
Expected: `lightweight-charts` appears under `"dependencies"` in `package.json`.

- [ ] **Step 2: Install Jest dev deps**

Run:
```bash
npm install --save-dev jest@^29 @types/jest@^29 ts-jest@^29
```
Expected: these three appear under `"devDependencies"`.

- [ ] **Step 3: Add `test` script to package.json**

Edit the `"scripts"` object in `package.json` to add:
```json
"test": "jest"
```
so the scripts block becomes:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "jest"
}
```

- [ ] **Step 4: Create Jest config**

Create `jest.config.mjs`:
```js
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
};
```

- [ ] **Step 5: Verify Jest runs (no tests yet)**

Run: `npm test -- --passWithNoTests`
Expected: `No tests found, exiting with code 0` (exit 0 thanks to the flag).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json jest.config.mjs
git commit -m "chore: add lightweight-charts dep and jest for unit tests"
```

---

## Task 2: Pure timeframe-selection function with tests

**Files:**
- Create: `app/lib/__tests__/chart-policy.test.ts`
- Create: `app/lib/chart-policy.ts`

- [ ] **Step 1: Write failing tests for `pickTimeframe`**

Create `app/lib/__tests__/chart-policy.test.ts`:
```ts
import { pickTimeframe } from '../chart-policy';

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;
const WEEK = 7 * DAY;

describe('pickTimeframe', () => {
  test('under 1 hour → M1', () => {
    expect(pickTimeframe(0)).toBe('M1');
    expect(pickTimeframe(59 * 60 * 1000)).toBe('M1');
  });
  test('1h up to 4h → M5', () => {
    expect(pickTimeframe(HOUR)).toBe('M5');
    expect(pickTimeframe(3 * HOUR + 59 * 60 * 1000)).toBe('M5');
  });
  test('4h up to 1d → M15', () => {
    expect(pickTimeframe(4 * HOUR)).toBe('M15');
    expect(pickTimeframe(DAY - 1)).toBe('M15');
  });
  test('1d up to 1w → H1', () => {
    expect(pickTimeframe(DAY)).toBe('H1');
    expect(pickTimeframe(WEEK - 1)).toBe('H1');
  });
  test('1w and longer → D1', () => {
    expect(pickTimeframe(WEEK)).toBe('D1');
    expect(pickTimeframe(4 * WEEK)).toBe('D1');
  });
  test('negative duration clamps to M1', () => {
    expect(pickTimeframe(-1000)).toBe('M1');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- chart-policy`
Expected: FAIL with `Cannot find module '../chart-policy'`.

- [ ] **Step 3: Implement `pickTimeframe`**

Create `app/lib/chart-policy.ts`:
```ts
import type { Timeframe } from './live-types';

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Map a trade's duration (ms) to a sensible candle timeframe.
 * Boundaries are inclusive on the lower end.
 */
export function pickTimeframe(durationMs: number): Timeframe {
  const d = Math.max(0, durationMs);
  if (d < HOUR) return 'M1';
  if (d < 4 * HOUR) return 'M5';
  if (d < DAY) return 'M15';
  if (d < WEEK) return 'H1';
  return 'D1';
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- chart-policy`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/lib/chart-policy.ts app/lib/__tests__/chart-policy.test.ts
git commit -m "feat(live): add pickTimeframe pure function + tests"
```

---

## Task 3: Pure window-computation function with tests

**Files:**
- Modify: `app/lib/__tests__/chart-policy.test.ts`
- Modify: `app/lib/chart-policy.ts`

- [ ] **Step 1: Write failing tests for `computeWindow`**

Append to `app/lib/__tests__/chart-policy.test.ts`:
```ts
import { computeWindow } from '../chart-policy';

describe('computeWindow', () => {
  test('20% padding on each side for a 1h trade on M5', () => {
    const open  = 1_000_000;
    const close = open + 60 * 60;            // 1h later
    const w = computeWindow(open, close, 'M5');
    expect(w.from).toBe(open  - 12 * 60);    // 20% of 3600s = 720s
    expect(w.to).toBe(  close + 12 * 60);
  });
  test('minimum padding clamps to 10 × timeframe for very short trades', () => {
    const open  = 1_000_000;
    const close = open + 30;                 // 30 seconds — tiny
    const w = computeWindow(open, close, 'M1');
    // pad = max(6s, 10 * 60s) = 600s
    expect(w.from).toBe(open  - 600);
    expect(w.to).toBe(  close + 600);
  });
  test('D1 trade gets day-sized padding', () => {
    const open  = 1_000_000;
    const close = open + 14 * 24 * 60 * 60;  // 2 weeks
    const w = computeWindow(open, close, 'D1');
    // pad = 20% of 14d = 2.8d in seconds
    expect(w.from).toBe(open  - Math.round(0.2 * 14 * 24 * 60 * 60));
    expect(w.to).toBe(  close + Math.round(0.2 * 14 * 24 * 60 * 60));
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- chart-policy`
Expected: FAIL with `computeWindow is not defined` (new tests fail; old ones still pass).

- [ ] **Step 3: Implement `computeWindow`**

Append to `app/lib/chart-policy.ts`:
```ts
const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  M1:  60,
  M5:  5 * 60,
  M15: 15 * 60,
  H1:  60 * 60,
  H4:  4 * 60 * 60,
  D1:  24 * 60 * 60,
};

/**
 * Pad a trade window by 20% of its duration on each side, clamped so padding
 * is never smaller than 10 × the timeframe's bar size. Returns UTC unix seconds.
 *
 * @param openTs   Trade open time (unix seconds UTC)
 * @param closeTs  Trade close time OR current time for open positions
 * @param tf       Chosen timeframe (affects the minimum-padding clamp)
 */
export function computeWindow(
  openTs: number,
  closeTs: number,
  tf: Timeframe,
): { from: number; to: number } {
  const duration = Math.max(0, closeTs - openTs);
  const rawPad   = duration * 0.2;
  const minPad   = 10 * TIMEFRAME_SECONDS[tf];
  const pad      = Math.max(Math.round(rawPad), minPad);
  return { from: openTs - pad, to: closeTs + pad };
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- chart-policy`
Expected: all 9 tests pass (6 old + 3 new).

- [ ] **Step 5: Commit**

```bash
git add app/lib/chart-policy.ts app/lib/__tests__/chart-policy.test.ts
git commit -m "feat(live): add computeWindow pure function + tests"
```

---

## Task 4: Extend `Modal` with `maxWidth` prop

**Files:**
- Modify: `app/components/shared/Modal.tsx`

- [ ] **Step 1: Add `maxWidth` prop, default to existing `'lg'`**

Replace the full contents of `app/components/shared/Modal.tsx` with:
```tsx
'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

type MaxWidth = 'lg' | '2xl' | '4xl' | '6xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: MaxWidth;
}

const MAX_WIDTH_CLASS: Record<MaxWidth, string> = {
  'lg':  'max-w-lg',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
};

export default function Modal({ open, onClose, title, children, maxWidth = 'lg' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`bg-bg-secondary rounded-2xl border border-border w-full ${MAX_WIDTH_CLASS[maxWidth]}`}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (no errors). All existing callers keep working because `maxWidth` is optional.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/Modal.tsx
git commit -m "feat(shared): add maxWidth prop to Modal"
```

---

## Task 5: Add `onRowClick` to `DataTable`

**Files:**
- Modify: `app/components/shared/DataTable.tsx`

- [ ] **Step 1: Add `onRowClick` prop and wire it to the row**

In `app/components/shared/DataTable.tsx`, replace the `DataTableProps<T>` interface (around lines 15–23):
```ts
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
}
```

Replace the component signature and the row markup. Find the existing signature block (around line 25):
```ts
export default function DataTable<T>({
  columns,
  data,
  sortable = true,
  pagination = true,
  pageSize = 20,
  emptyMessage = 'No data available',
  rowKey,
}: DataTableProps<T>) {
```

Replace with:
```ts
export default function DataTable<T>({
  columns,
  data,
  sortable = true,
  pagination = true,
  pageSize = 20,
  emptyMessage = 'No data available',
  rowKey,
  onRowClick,
}: DataTableProps<T>) {
```

Find the row rendering (around line 105):
```tsx
{displayed.map((row, i) => (
  <tr key={rowKey(row, i)} className="hover:bg-bg-tertiary/50 transition-colors">
```

Replace with:
```tsx
{displayed.map((row, i) => (
  <tr
    key={rowKey(row, i)}
    className={`hover:bg-bg-tertiary/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
    onClick={onRowClick ? () => onRowClick(row) : undefined}
  >
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (existing callers don't pass `onRowClick`, which is optional).

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/DataTable.tsx
git commit -m "feat(shared): add onRowClick prop to DataTable"
```

---

## Task 6: Implement `TradeBoxPrimitive`

**Files:**
- Create: `app/components/live/TradeBoxPrimitive.ts`

Self-contained `ISeriesPrimitive`. No React, no hooks. Takes overlay geometry in its constructor, exposes `update()` and `setColors()` for in-place mutation. Renders reward + risk boxes, P&L band, entry→current connector, and right-edge labels.

- [ ] **Step 1: Create the file with geometry types and the primitive class**

Create `app/components/live/TradeBoxPrimitive.ts`:
```ts
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesType,
  Time,
} from 'lightweight-charts';

// fancy-canvas ships as a transitive dep of lightweight-charts and its
// CanvasRenderingTarget2D type isn't re-exported from the main entry. We
// infer the target type from the renderer interface so we never import it.
type DrawTarget = Parameters<ISeriesPrimitivePaneRenderer['draw']>[0];

export interface TradeBoxOverlays {
  side: 'buy' | 'sell';
  openTime: number;              // unix seconds UTC
  openPrice: number;
  closeTime?: number;
  closePrice?: number;
  currentPrice?: number;
  sl: number | null;
  tp: number | null;
  profit: number;
  symbol: string;
}

export interface TradeBoxColors {
  profit: string;                // rgb() — opacity is applied in the renderer
  loss: string;
  textPrimary: string;
  textMuted: string;
}

class TradeBoxRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(
    private readonly chart: IChartApi,
    private readonly series: ISeriesApi<SeriesType>,
    private readonly overlays: TradeBoxOverlays,
    private readonly colors: TradeBoxColors,
  ) {}

  draw(target: DrawTarget) {
    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const { width } = scope.bitmapSize;

      const timeScale = this.chart.timeScale();
      const xOpen = timeScale.timeToCoordinate(this.overlays.openTime as Time);
      if (xOpen === null) return;
      const xRight = width;                             // extend to chart right edge

      const yOpen = this.series.priceToCoordinate(this.overlays.openPrice);
      if (yOpen === null) return;

      const pxRatio = scope.horizontalPixelRatio;
      const x0 = xOpen * pxRatio;
      const y0 = yOpen * scope.verticalPixelRatio;

      // Reward box (open → tp)
      if (this.overlays.tp !== null) {
        const yTp = this.series.priceToCoordinate(this.overlays.tp);
        if (yTp !== null) {
          const yTpPx = yTp * scope.verticalPixelRatio;
          this.fillRect(ctx, x0, Math.min(y0, yTpPx), xRight - x0, Math.abs(yTpPx - y0),
                        this.rgba(this.colors.profit, 0.12));
        }
      }
      // Risk box (sl → open)
      if (this.overlays.sl !== null) {
        const ySl = this.series.priceToCoordinate(this.overlays.sl);
        if (ySl !== null) {
          const ySlPx = ySl * scope.verticalPixelRatio;
          this.fillRect(ctx, x0, Math.min(y0, ySlPx), xRight - x0, Math.abs(ySlPx - y0),
                        this.rgba(this.colors.loss, 0.12));
        }
      }

      // P&L band: between openPrice and currentPrice/closePrice
      const endPrice = this.overlays.currentPrice ?? this.overlays.closePrice;
      if (endPrice !== undefined) {
        const yEnd = this.series.priceToCoordinate(endPrice);
        if (yEnd !== null) {
          const yEndPx = yEnd * scope.verticalPixelRatio;
          const isWinning = this.overlays.profit >= 0;
          this.fillRect(ctx, x0, Math.min(y0, yEndPx), xRight - x0, Math.abs(yEndPx - y0),
                        this.rgba(isWinning ? this.colors.profit : this.colors.loss, 0.22));

          // Entry → current/close connector: dashed line
          const xEndTs = this.overlays.closeTime ?? this.overlays.openTime;
          const xEnd = timeScale.timeToCoordinate(xEndTs as Time);
          if (xEnd !== null) {
            const xEndPx = xEnd * pxRatio;
            ctx.save();
            ctx.strokeStyle = this.rgba(isWinning ? this.colors.profit : this.colors.loss, 0.9);
            ctx.lineWidth = 1 * pxRatio;
            ctx.setLineDash([4 * pxRatio, 4 * pxRatio]);
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(xEndPx, yEndPx);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    });
  }

  private fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  /** Accepts "rgb(r, g, b)" or "#rrggbb"; appends alpha. */
  private rgba(color: string, alpha: number): string {
    const c = color.trim();
    if (c.startsWith('#')) {
      const r = parseInt(c.slice(1, 3), 16);
      const g = parseInt(c.slice(3, 5), 16);
      const b = parseInt(c.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    const m = c.match(/\d+/g);
    if (m && m.length >= 3) {
      return `rgba(${m[0]},${m[1]},${m[2]},${alpha})`;
    }
    return c;
  }
}

class TradeBoxPaneView implements ISeriesPrimitivePaneView {
  constructor(
    private readonly chart: IChartApi,
    private readonly series: ISeriesApi<SeriesType>,
    private overlays: TradeBoxOverlays,
    private colors: TradeBoxColors,
  ) {}

  zOrder() { return 'bottom' as const; }

  setOverlays(o: TradeBoxOverlays) { this.overlays = o; }
  setColors(c: TradeBoxColors)     { this.colors = c; }

  renderer(): ISeriesPrimitivePaneRenderer {
    return new TradeBoxRenderer(this.chart, this.series, this.overlays, this.colors);
  }
}

export class TradeBoxPrimitive implements ISeriesPrimitive<Time> {
  private readonly view: TradeBoxPaneView;
  private requestUpdate: (() => void) | null = null;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    overlays: TradeBoxOverlays,
    colors: TradeBoxColors,
  ) {
    this.view = new TradeBoxPaneView(chart, series, overlays, colors);
  }

  // lightweight-charts v5 primitive lifecycle hooks
  attached(param: { requestUpdate: () => void }) {
    this.requestUpdate = param.requestUpdate;
  }
  detached() {
    this.requestUpdate = null;
  }

  paneViews() { return [this.view]; }
  updateAllViews() { /* views read from their own fields */ }

  update(overlays: TradeBoxOverlays) {
    this.view.setOverlays(overlays);
    this.requestUpdate?.();
  }
  setColors(colors: TradeBoxColors) {
    this.view.setColors(colors);
    this.requestUpdate?.();
  }
}
```

> **Note on right-edge labels:** The labels described in the spec (TP / P&L / SL pill labels on the right edge) are deferred from this task to Task 7 step 6, where they are drawn as HTML siblings over the chart rather than into the canvas — simpler, theme-aware via Tailwind, and keeps this primitive scope-limited to geometry.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output. (lightweight-charts types are pulled in from the dep installed in Task 1.)

- [ ] **Step 3: Commit**

```bash
git add app/components/live/TradeBoxPrimitive.ts
git commit -m "feat(live): add TradeBoxPrimitive for chart overlay geometry"
```

---

## Task 7: Implement `<PositionChart/>` component

**Files:**
- Create: `app/components/live/PositionChart.tsx`

- [ ] **Step 1: Create the chart component**

Create `app/components/live/PositionChart.tsx`:
```tsx
'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { CandleBar, Timeframe } from '../../lib/live-types';
import {
  TradeBoxPrimitive,
  type TradeBoxColors,
  type TradeBoxOverlays,
} from './TradeBoxPrimitive';

interface PositionChartProps {
  bars: CandleBar[];
  timeframe: Timeframe;
  overlays: TradeBoxOverlays;
  height?: number;
}

function readChartColors(): TradeBoxColors & {
  bg: string; grid: string; border: string; text: string;
} {
  const s = getComputedStyle(document.documentElement);
  const get = (n: string, fallback: string) => {
    const v = s.getPropertyValue(n).trim();
    return v || fallback;
  };
  return {
    profit:      get('--color-profit',       '#10b981'),
    loss:        get('--color-loss',         '#ef4444'),
    textPrimary: get('--color-text-primary', '#f1f5f9'),
    textMuted:   get('--color-text-muted',   '#64748b'),
    bg:          get('--color-bg-secondary', '#0f172a'),
    grid:        get('--color-border',       '#1e293b'),
    border:      get('--color-border',       '#1e293b'),
    text:        get('--color-text-primary', '#f1f5f9'),
  };
}

export default function PositionChart({ bars, timeframe, overlays, height = 420 }: PositionChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const primitiveRef = useRef<TradeBoxPrimitive | null>(null);
  const lastBarTime  = useRef<number | null>(null);

  // Mount: create chart + series + primitive
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const colors = readChartColors();
    const chart = createChart(el, {
      layout:     { background: { color: colors.bg }, textColor: colors.text },
      grid:       { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.border },
      timeScale:       { borderColor: colors.border, timeVisible: true, secondsVisible: timeframe === 'M1' },
      autoSize:   true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor:         colors.profit,
      downColor:       colors.loss,
      borderVisible:   false,
      wickUpColor:     colors.profit,
      wickDownColor:   colors.loss,
    });
    const primitive = new TradeBoxPrimitive(chart, series, overlays, colors);
    series.attachPrimitive(primitive);

    chartRef.current     = chart;
    seriesRef.current    = series;
    primitiveRef.current = primitive;

    return () => {
      chart.remove();
      chartRef.current     = null;
      seriesRef.current    = null;
      primitiveRef.current = null;
      lastBarTime.current  = null;
    };
    // Re-create the chart only if timeframe changes (alters timeScale options).
    // Bar data and overlays are pushed via the effects below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  // Bars: setData first time, then update(last bar) for incremental changes.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || bars.length === 0) return;

    const lwcBars = bars.map(b => ({
      time:  b.time as UTCTimestamp,
      open:  b.open,
      high:  b.high,
      low:   b.low,
      close: b.close,
    }));

    const last = lwcBars[lwcBars.length - 1];
    if (lastBarTime.current === null) {
      series.setData(lwcBars);
      chartRef.current?.timeScale().fitContent();
    } else if (last.time === lastBarTime.current) {
      series.update(last);                     // same last bar, updated values
    } else if ((last.time as number) > lastBarTime.current) {
      // New bar arrived — update with new last (plus any prior missing bars)
      const newSlice = lwcBars.filter(b => (b.time as number) >= lastBarTime.current!);
      for (const b of newSlice) series.update(b);
    } else {
      // Window changed (different trade / refetch) — reset.
      series.setData(lwcBars);
    }
    lastBarTime.current = last.time as number;
  }, [bars]);

  // Overlays: push through without recreating the primitive.
  useEffect(() => {
    primitiveRef.current?.update(overlays);
  }, [overlays]);

  // Side-bar labels (deferred-from-primitive): keep as HTML siblings, positioned
  // by absolute coordinates converted from prices. Simpler and theme-friendly.
  // (First-pass: compact pills in the component's top-right corner.)
  const fmt = (n: number) => n.toFixed(5).replace(/0+$/, '0');
  const pl  = overlays.profit;
  const plColor = pl >= 0 ? 'text-profit' : 'text-loss';

  return (
    <div className="relative" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 flex flex-col gap-1 pointer-events-none">
        {overlays.tp !== null && (
          <span className="bg-bg-tertiary/80 text-profit text-[11px] font-mono px-2 py-0.5 rounded border border-border">
            TP {fmt(overlays.tp)}
          </span>
        )}
        <span className={`bg-bg-tertiary/80 ${plColor} text-[11px] font-mono px-2 py-0.5 rounded border border-border`}>
          P&L {pl >= 0 ? '+' : ''}{pl.toFixed(2)}
        </span>
        {overlays.sl !== null && (
          <span className="bg-bg-tertiary/80 text-loss text-[11px] font-mono px-2 py-0.5 rounded border border-border">
            SL {fmt(overlays.sl)}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/components/live/PositionChart.tsx
git commit -m "feat(live): add PositionChart with candles + trade-box primitive"
```

---

## Task 8: Implement `usePositionChart` hook (closed-trade path only)

Start with the closed-trade path (simpler, no polling), to verify the full fetch → render pipeline before adding live updates in Task 9.

**Files:**
- Create: `app/hooks/usePositionChart.ts`

- [ ] **Step 1: Create the hook with closed-trade fetch**

Create `app/hooks/usePositionChart.ts`:
```ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  CandleBar,
  LivePosition,
  LiveTrade,
  RatesResponse,
  Timeframe,
} from '../lib/live-types';
import { computeWindow, pickTimeframe } from '../lib/chart-policy';

export type PositionLike =
  | { kind: 'open';   position: LivePosition; currentPrice: number }
  | { kind: 'closed'; trade:    LiveTrade };

export interface PositionChartState {
  status: 'loading' | 'ready' | 'error';
  bars:   CandleBar[];
  timeframe: Timeframe;
  window: { from: number; to: number };
  error?: string;
  retry: () => void;
  isStale: boolean;
}

function errorMessage(status: number): string {
  switch (status) {
    case 503: return "MT5 bridge offline — can't load chart";
    case 404: return 'Chart unavailable: symbol not found on this account';
    case 400: return 'Chart configuration error';
    default:  return "Couldn't load chart";
  }
}

export function usePositionChart(input: PositionLike, accountId: string): PositionChartState {
  // Derive time and symbol from the DU input
  const { symbol, openTs, closeTs } = useMemo(() => {
    if (input.kind === 'open') {
      return {
        symbol:  input.position.symbol,
        openTs:  Math.floor(new Date(input.position.open_time).getTime() / 1000),
        closeTs: Math.floor(Date.now() / 1000),
      };
    }
    return {
      symbol:  input.trade.symbol,
      openTs:  Math.floor(new Date(input.trade.open_time).getTime() / 1000),
      closeTs: Math.floor(new Date(input.trade.close_time).getTime() / 1000),
    };
  }, [input]);

  const timeframe = useMemo(
    () => pickTimeframe((closeTs - openTs) * 1000),
    [closeTs, openTs],
  );
  const range = useMemo(
    () => computeWindow(openTs, closeTs, timeframe),
    [openTs, closeTs, timeframe],
  );

  const [bars, setBars]     = useState<CandleBar[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError]   = useState<string | undefined>();
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setStatus('loading');
    setError(undefined);

    const url = `/api/live/rates?accountId=${encodeURIComponent(accountId)}`
              + `&symbol=${encodeURIComponent(symbol)}`
              + `&timeframe=${timeframe}`
              + `&from=${range.from}&to=${range.to}`;

    fetch(url, { signal: ctrl.signal })
      .then(async res => {
        if (!res.ok) {
          throw Object.assign(new Error('fetch failed'), { status: res.status });
        }
        const data: RatesResponse = await res.json();
        setBars(data.bars);
        setStatus('ready');
      })
      .catch((e: { name?: string; status?: number }) => {
        if (e.name === 'AbortError') return;
        setStatus('error');
        setError(errorMessage(e.status ?? 0));
      });

    return () => ctrl.abort();
  }, [accountId, symbol, timeframe, range.from, range.to, retryNonce]);

  return {
    status,
    bars,
    timeframe,
    window: range,
    error,
    retry:  () => setRetryNonce(n => n + 1),
    isStale: false,                            // populated in Task 9
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/hooks/usePositionChart.ts
git commit -m "feat(live): add usePositionChart hook (closed-trade path)"
```

---

## Task 9: Extend `usePositionChart` with open-position live updates

**Files:**
- Modify: `app/hooks/usePositionChart.ts`

Reuse the existing `useLiveData` polling cadence indirectly: the caller (modal) will re-invoke the hook each time its position prop changes (which happens on every poll cycle when the modal is consuming the live page's position list). We detect `kind === 'open'` and refetch the trailing window on each render where `currentPrice` changes.

- [ ] **Step 1: Add live-update effect for open positions**

Append to `app/hooks/usePositionChart.ts`, after the initial-fetch `useEffect`:
```ts
  // --- Live update path (open positions only) -----------------------
  const [isStale, setIsStale] = useState(false);
  const [failures, setFailures] = useState(0);
  const lastBarTime = bars.length ? bars[bars.length - 1].time : null;
  const currentPrice = input.kind === 'open' ? input.currentPrice : null;

  useEffect(() => {
    if (input.kind !== 'open' || status !== 'ready' || lastBarTime === null) return;

    const ctrl = new AbortController();
    const now = Math.floor(Date.now() / 1000);
    const url = `/api/live/rates?accountId=${encodeURIComponent(accountId)}`
              + `&symbol=${encodeURIComponent(symbol)}`
              + `&timeframe=${timeframe}`
              + `&from=${lastBarTime}&to=${now}`;

    fetch(url, { signal: ctrl.signal })
      .then(async res => {
        if (!res.ok) throw new Error('poll failed');
        const data: RatesResponse = await res.json();
        if (data.bars.length === 0) return;
        setBars(prev => {
          const next = [...prev];
          for (const b of data.bars) {
            if (next.length && next[next.length - 1].time === b.time) {
              next[next.length - 1] = b;                    // replace last bar
            } else if (next.length === 0 || b.time > next[next.length - 1].time) {
              next.push(b);                                  // append new bar
            }
          }
          return next;
        });
        setFailures(0);
        setIsStale(false);
      })
      .catch((e: { name?: string }) => {
        if (e.name === 'AbortError') return;
        setFailures(f => {
          const nf = f + 1;
          if (nf >= 3) setIsStale(true);
          return nf;
        });
      });

    return () => ctrl.abort();
    // `currentPrice` is the poll-change signal: when live data updates, it moves,
    // and we refetch the tail. `lastBarTime` also changes as bars are appended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice, lastBarTime, status, accountId, symbol, timeframe, input.kind]);
```

Then replace the returned object's `isStale: false,` with `isStale,`. (Remove the placeholder; wire the real value.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/hooks/usePositionChart.ts
git commit -m "feat(live): add live-update polling to usePositionChart"
```

---

## Task 10: Implement `<PositionChartModal/>`

**Files:**
- Create: `app/components/live/PositionChartModal.tsx`

- [ ] **Step 1: Create the modal wrapping hook + chart**

Create `app/components/live/PositionChartModal.tsx`:
```tsx
'use client';

import { useMemo } from 'react';
import { formatDateTime } from '../../lib/format-datetime';
import { useSettings } from '../../lib/settings-context';
import Modal from '../shared/Modal';
import PositionChart from './PositionChart';
import { usePositionChart, type PositionLike } from '../../hooks/usePositionChart';
import type { TradeBoxOverlays } from './TradeBoxPrimitive';

interface PositionChartModalProps {
  input: PositionLike | null;                  // null = closed; controls open/close
  accountId: string;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default function PositionChartModal({ input, accountId, onClose }: PositionChartModalProps) {
  const { timezone } = useSettings();
  const isOpen = input !== null;

  // Hook needs a stable input even when modal is closed; use a sentinel object.
  // Calling the hook conditionally would break React's rules-of-hooks.
  const hookInput: PositionLike = input ?? {
    kind: 'closed',
    trade: {
      ticket: 0, symbol: '', type: 'buy', volume: 0, open_price: 0, close_price: 0,
      open_time: new Date(0).toISOString(), close_time: new Date(0).toISOString(),
      profit: 0, commission: 0, swap: 0, comment: '', magic: 0,
    },
  };
  const chart = usePositionChart(hookInput, accountId);

  const { title, subheader, overlays } = useMemo(() => {
    if (!input) {
      return { title: '', subheader: null, overlays: null as TradeBoxOverlays | null };
    }
    if (input.kind === 'open') {
      const p = input.position;
      const openTs  = Math.floor(new Date(p.open_time).getTime() / 1000);
      const openMs  = openTs * 1000;
      return {
        title: `${p.symbol} • ${p.type.toUpperCase()} ${p.volume.toFixed(2)} • ${chart.timeframe}`,
        subheader: (
          <>
            Open {formatDateTime(p.open_time, timezone)} • Duration {formatDuration(Date.now() - openMs)}
            <span className={`ml-3 ${p.profit >= 0 ? 'text-profit' : 'text-loss'} font-semibold`}>
              P/L: {p.profit >= 0 ? '+' : ''}{formatCurrency(p.profit)}
            </span>
          </>
        ),
        overlays: {
          side: p.type, openTime: openTs, openPrice: p.open_price,
          currentPrice: p.current_price, sl: p.sl, tp: p.tp,
          profit: p.profit, symbol: p.symbol,
        },
      };
    }
    const t = input.trade;
    const openTs  = Math.floor(new Date(t.open_time).getTime() / 1000);
    const closeTs = Math.floor(new Date(t.close_time).getTime() / 1000);
    return {
      title: `${t.symbol} • ${t.type.toUpperCase()} ${t.volume.toFixed(2)} • ${chart.timeframe}`,
      subheader: (
        <>
          {formatDateTime(t.open_time, timezone)} → {formatDateTime(t.close_time, timezone)}
          <span className="ml-3">Duration {formatDuration((closeTs - openTs) * 1000)}</span>
          <span className={`ml-3 ${t.profit >= 0 ? 'text-profit' : 'text-loss'} font-semibold`}>
            P/L: {t.profit >= 0 ? '+' : ''}{formatCurrency(t.profit)}
          </span>
        </>
      ),
      overlays: {
        side: t.type, openTime: openTs, openPrice: t.open_price,
        closeTime: closeTs, closePrice: t.close_price,
        sl: t.sl, tp: t.tp, profit: t.profit, symbol: t.symbol,
      },
    };
  }, [input, chart.timeframe, timezone]);

  return (
    <Modal open={isOpen} onClose={onClose} title={title} maxWidth="6xl">
      <div className="space-y-3">
        <div className="text-xs text-text-muted">{subheader}</div>
        <div className="relative">
          {chart.status === 'loading' && (
            <div className="h-[420px] bg-bg-tertiary/40 rounded animate-pulse" />
          )}
          {chart.status === 'error' && (
            <div className="h-[420px] flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-text-muted text-sm">{chart.error}</p>
              <button
                onClick={chart.retry}
                className="px-3 py-1.5 text-xs font-medium bg-bg-tertiary hover:bg-bg-primary border border-border rounded"
              >
                Retry
              </button>
            </div>
          )}
          {chart.status === 'ready' && chart.bars.length === 0 && (
            <div className="h-[420px] flex items-center justify-center text-text-muted text-sm">
              No candle data for this range
            </div>
          )}
          {chart.status === 'ready' && chart.bars.length > 0 && overlays && (
            <PositionChart bars={chart.bars} timeframe={chart.timeframe} overlays={overlays} />
          )}
          {chart.isStale && chart.status === 'ready' && (
            <span className="absolute top-2 left-2 text-[10px] font-mono text-text-muted bg-bg-tertiary/80 border border-border px-2 py-0.5 rounded">
              Live updates paused
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/components/live/PositionChartModal.tsx
git commit -m "feat(live): add PositionChartModal composing hook + chart"
```

---

## Task 11: Wire row click in `TradesTab`

**Files:**
- Modify: `app/components/live/TradesTab.tsx`

- [ ] **Step 1: Accept `accountId` prop and manage modal state**

Open `app/components/live/TradesTab.tsx`. Replace the `TradesTabProps` interface (around lines 11–15):
```ts
interface TradesTabProps {
  trades: LiveTrade[];
  startingCapital: number;
  displayMode: DisplayMode;
  accountId: string;
}
```

Replace the default export's signature (around line 26):
```ts
export default function TradesTab({ trades, startingCapital, displayMode, accountId }: TradesTabProps) {
```

Add the required imports at the top of the file:
```ts
import { useState } from 'react';
import PositionChartModal from './PositionChartModal';
import type { PositionLike } from '../../hooks/usePositionChart';
```

(Note: `useState` may already be imported — check and don't duplicate.)

Immediately inside the component body (after existing `useState`/`useMemo` calls), add:
```ts
const [chartInput, setChartInput] = useState<PositionLike | null>(null);
```

Find the `DataTable` render call. Add `onRowClick`:
```tsx
<DataTable
  /* existing props */
  onRowClick={(row) => setChartInput({ kind: 'closed', trade: row as LiveTrade })}
/>
```

(The exact existing prop list depends on the current file — don't delete any of them; just add `onRowClick`.)

At the very bottom of the rendered JSX, before the closing `</div>` of the root element, add:
```tsx
<PositionChartModal
  input={chartInput}
  accountId={accountId}
  onClose={() => setChartInput(null)}
/>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: error about `TradesTab` missing the `accountId` prop at its call site in `app/live/page.tsx`. (Fixed in Task 12.)

- [ ] **Step 3: Commit**

```bash
git add app/components/live/TradesTab.tsx
git commit -m "feat(live): open PositionChartModal on TradesTab row click"
```

---

## Task 12: Pass `accountId` to `TradesTab` from live page

**Files:**
- Modify: `app/live/page.tsx`

- [ ] **Step 1: Add `accountId` prop to the `TradesTab` render**

In `app/live/page.tsx`, find the `TradesTab` render (currently line 177–179):
```tsx
{activeTab === 'trades' && liveData.account && (
  <TradesTab trades={liveData.history} startingCapital={startingCapital} displayMode={displayMode} />
)}
```

Replace with:
```tsx
{activeTab === 'trades' && liveData.account && accountId && (
  <TradesTab
    trades={liveData.history}
    startingCapital={startingCapital}
    displayMode={displayMode}
    accountId={accountId}
  />
)}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/live/page.tsx
git commit -m "feat(live): plumb accountId to TradesTab"
```

---

## Task 13: Wire row click in `OpenPositionsTable`

**Files:**
- Modify: `app/components/live/OpenPositionsTable.tsx`

- [ ] **Step 1: Accept `accountId` prop and manage modal state**

Open `app/components/live/OpenPositionsTable.tsx`. Replace the `OpenPositionsTableProps` interface (line 8):
```ts
interface OpenPositionsTableProps {
  positions: LivePosition[];
  accountId: string;
}
```

Replace the default export's signature (line 158):
```ts
export default function OpenPositionsTable({ positions, accountId }: OpenPositionsTableProps) {
```

Add imports at the top of the file, after the existing imports:
```ts
import { useState } from 'react';
import PositionChartModal from './PositionChartModal';
import type { PositionLike } from '../../hooks/usePositionChart';
```

Inside the component body, before the `return`, add:
```ts
const [chartInput, setChartInput] = useState<PositionLike | null>(null);
```

In the `DataTable` render call, add `onRowClick`:
```tsx
<DataTable
  columns={columns}
  data={positions}
  pagination={false}
  sortable={true}
  emptyMessage="No open positions"
  rowKey={(row) => String(row.ticket)}
  onRowClick={(row) =>
    setChartInput({ kind: 'open', position: row as LivePosition, currentPrice: (row as LivePosition).current_price })
  }
/>
```

At the bottom of the rendered JSX, just before the outermost closing `</div>`, add:
```tsx
<PositionChartModal
  input={chartInput}
  accountId={accountId}
  onClose={() => setChartInput(null)}
/>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: error about missing `accountId` prop on `OpenPositionsTable` in `app/live/page.tsx`. (Fixed next step.)

- [ ] **Step 3: Pass `accountId` from the live page**

In `app/live/page.tsx`, find the `OpenPositionsTable` render (line 163):
```tsx
<OpenPositionsTable positions={liveData.positions} />
```

Replace with:
```tsx
{accountId && <OpenPositionsTable positions={liveData.positions} accountId={accountId} />}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add app/components/live/OpenPositionsTable.tsx app/live/page.tsx
git commit -m "feat(live): open PositionChartModal on OpenPositionsTable row click"
```

---

## Task 14: Manual QA in the browser

No code changes. Validate the complete feature against a running dev build.

- [ ] **Step 1: Run the dev build**

Either `npm run dev` and open http://localhost:3000 directly, **or** rebuild the Docker image (`docker build -t metatrader-journal:latest . && docker stop trading && docker rm trading && <run cmd>`) and open http://livetrades.local. Both must pick up the new `lightweight-charts` dep from `package.json`.

- [ ] **Step 2: Closed winning trade**

Go to the Trades tab on the live page. Click any trade with `profit > 0`.
Expected:
- Modal opens at ~6xl width; header shows `<symbol> • <side> <vol> • <timeframe>`.
- Subheader shows open → close timestamps, duration, P/L.
- Chart renders candles; reward box (green tint) fills above the entry to TP; risk box (red tint) below to SL (if both levels are set).
- Dashed connector runs from entry point to exit point; color matches profit/loss.
- Right-corner labels show TP / P&L / SL.
- Close the modal — no console errors, no leftover DOM.

- [ ] **Step 3: Closed losing trade**

Click a trade with `profit < 0`. Expected visuals analogous to Step 2 but the P&L band and connector should be in the red (loss) color.

- [ ] **Step 4: Trade with missing SL or TP**

Click a trade where `sl === null` or `tp === null`. Expected: the corresponding box is omitted; the other box still renders; no errors.

- [ ] **Step 5: Open position — live updates**

Go to Open Positions. Click any open position.
Expected:
- Initial chart renders for the appropriate auto-picked timeframe (most likely M15 or M5 depending on duration).
- After ~5s (one poll cycle), the last candle updates in place OR a new bar appears (depending on whether the timeframe boundary has passed).
- The P&L number in the subheader updates with each poll.
- The right-edge P&L label updates.

- [ ] **Step 6: Bridge offline**

Temporarily `docker stop` the bridge (or disconnect the SSH tunnel). Click any trade.
Expected: "MT5 bridge offline — can't load chart" inline with a Retry button. Clicking Retry after restarting the bridge recovers.

- [ ] **Step 7: Commit QA notes if anything surfaced**

If you found and fixed anything during QA, commit those fixes; otherwise no commit needed.

---

## Self-Review

**Spec coverage:**
- Architecture diagram → Tasks 6-13 build every box.
- Bridge `/rates` — pre-built, noted at top.
- Next.js proxy — pre-built, noted.
- `pickTimeframe` / `computeWindow` — Tasks 2-3 with tests.
- `usePositionChart` — Tasks 8-9.
- `PositionChart` — Task 7.
- `TradeBoxPrimitive` — Task 6 (explicit spec: reward/risk/P&L band/connector). Right-edge labels: moved out of the primitive into HTML in Task 7 with a note; labels still rendered, just in a different place than the mock suggests. Trade-off is in the plan.
- `PositionChartModal` — Task 10.
- `DataTable onRowClick` — Task 5.
- Wiring — Tasks 11-13.
- Error/empty/stale states — Task 10.
- Manual QA — Task 14.

**Placeholder scan:** no TBD/TODO/"handle edge cases". Right-edge labels in the canvas are explicitly deferred to a different rendering approach (HTML siblings) with rationale.

**Type consistency:** `TradeBoxOverlays` defined in Task 6, used identically in Task 7 and Task 10. `PositionLike` defined in Task 8, imported in Tasks 10/11/13. `Timeframe`, `CandleBar`, `RatesResponse` were added in the pre-existing commit on this branch.

**Known deviation from spec:**
- Right-edge pill labels live in HTML (PositionChart) rather than in the canvas primitive. This is simpler, theme-friendly, and keeps the primitive focused on geometry. Visual effect is equivalent — pills in the top-right corner of the chart rather than against the right price-axis edge. If you want them anchored precisely to the right edge next to each box, that's a straightforward follow-up.
