# Tab P&L Indicator — Design Spec

## Overview

Replace the static browser tab (favicon + title) with a dynamic indicator that shows the total floating P&L of open positions. When positions are open, the favicon becomes a canvas-rendered icon with a directional arrow and rounded dollar value; the tab title shows the exact P&L. When no positions are open, the favicon shows a neutral gray indicator and the title reverts to "MT5 Journal".

## Architecture

A new custom hook `useTabIndicator` receives the positions array from `useLiveData` and manages two DOM side effects: a dynamically generated canvas favicon and `document.title`. No new components, no changes to data fetching.

```
useLiveData → positions[] → useTabIndicator(positions) → canvas favicon + document.title
```

### New file

**`app/hooks/useTabIndicator.ts`**

A `'use client'` hook that:

1. Accepts `positions: LivePosition[]` as its argument.
2. Computes `totalFloating` by summing `position.profit` across all positions (same calculation already used in `OpenPositionsTable`).
3. Renders a 32×32 canvas favicon using the two-line layout described below.
4. Sets `document.title` to the formatted P&L string or the default app title.
5. Runs in a `useEffect` keyed on the positions array — updates every time positions change (every ~5s poll cycle).
6. Cleans up on unmount: restores the original favicon and title.

### Modified file

**`app/live/page.tsx`**

Add one line inside `LivePageContent`:

```ts
useTabIndicator(liveData.positions);
```

No other changes needed.

## Favicon Rendering

Canvas size: 32×32 pixels. The favicon is set by creating/updating a `<link rel="icon">` element in the document head with a `canvas.toDataURL()` value.

### Layout: two-line, arrow + value

- **Top line:** Directional arrow — `▲` for profit, `▼` for loss
- **Bottom line:** Compact rounded value

### Color scheme

| State | Background | Text |
|-------|-----------|------|
| Profit (≥ 0) | `#16a34a` (green-600) | White |
| Loss (< 0) | `#dc2626` (red-600) | White |
| No positions | `#475569` (slate-600) | White |

### Value formatting (favicon)

The favicon has limited space. Values are compacted:

- `|value| < 1000` → rounded integer, e.g. `32`, `8`, `143`
- `|value| >= 1000` → compact with K suffix, e.g. `1.4K`, `12K`

The sign is conveyed by the arrow, not repeated in the number.

### No positions state

- Background: `#475569` (gray)
- Single centered em-dash `—`
- No arrow, no number

## Tab Title

| State | Title |
|-------|-------|
| Positions open, profit | `+$31.86` |
| Positions open, loss | `-$8.23` |
| No positions | `MT5 Journal` |

The title value uses the full precision from the floating P&L (formatted with `Intl.NumberFormat` for currency), not the compacted favicon value.

## Update Frequency

Every poll cycle (~5 seconds), matching the existing `useLiveData` fast polling interval. No additional throttling — the canvas render is lightweight.

## Cleanup

On hook unmount (navigating away from `/live`), restore:
- `document.title` to `"MT5 Journal - Trading Dashboard"` (the static metadata value)
- Remove the dynamic favicon `<link>` element so the browser falls back to default

## Edge Cases

- **Zero floating P&L with open positions:** Treated as profit (green ▲, shows `0`). Title shows `+$0.00`.
- **Very large values (e.g. +$99,999):** Formatted as `100K` in favicon. Title shows full value.
- **Server-side rendering:** Hook is `'use client'` only. Canvas and document APIs are only accessed inside `useEffect`.
- **Multiple tabs:** Each tab independently renders its own favicon based on its own poll data. No cross-tab coordination needed.
- **Page not on /live route:** Hook is only called from the live page, so other pages keep the default static title/favicon.
