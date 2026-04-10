# Tab P&L Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the total floating P&L of open positions in the browser tab — as a canvas-rendered favicon (arrow + value) and as the tab title.

**Architecture:** A single custom hook `useTabIndicator` takes the positions array, computes total floating P&L, renders a 32×32 canvas favicon, and sets `document.title`. Called from the live page with one line.

**Tech Stack:** React hooks, Canvas API, DOM manipulation (`<link rel="icon">`, `document.title`)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/hooks/useTabIndicator.ts` | Create | Hook: compute P&L, render canvas favicon, set document.title |
| `app/live/page.tsx` | Modify | Call `useTabIndicator(liveData.positions)` |

---

### Task 1: Create `useTabIndicator` hook — favicon rendering helpers

**Files:**
- Create: `app/hooks/useTabIndicator.ts`

- [ ] **Step 1: Create the hook file with helper functions**

Create `app/hooks/useTabIndicator.ts` with the compact value formatter and canvas rendering function:

```ts
'use client';

import { useEffect, useRef } from 'react';
import { LivePosition } from '../lib/live-types';

const DEFAULT_TITLE = 'MT5 Journal - Trading Dashboard';
const NO_POSITION_TITLE = 'MT5 Journal';
const FAVICON_SIZE = 32;

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const k = abs / 1000;
    return k >= 10 ? Math.round(k) + 'K' : k.toFixed(1) + 'K';
  }
  return String(Math.round(abs));
}

function formatCurrencyTitle(value: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return (value >= 0 ? '+' : '-') + formatted;
}

function renderFavicon(canvas: HTMLCanvasElement, value: number | null): string {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, FAVICON_SIZE, FAVICON_SIZE);

  let bg: string;

  if (value === null) {
    // No positions — gray with em-dash
    bg = '#475569';
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, FAVICON_SIZE, FAVICON_SIZE, 5);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(FAVICON_SIZE * 0.44)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('—', FAVICON_SIZE / 2, FAVICON_SIZE / 2 + 1);
  } else {
    const isProfit = value >= 0;
    bg = isProfit ? '#16a34a' : '#dc2626';

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, FAVICON_SIZE, FAVICON_SIZE, 5);
    ctx.fill();

    // Arrow on top
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(FAVICON_SIZE * 0.31)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isProfit ? '▲' : '▼', FAVICON_SIZE / 2, FAVICON_SIZE * 0.31);

    // Compact value on bottom
    const numText = formatCompact(value);
    ctx.font = `bold ${Math.round(FAVICON_SIZE * 0.34)}px monospace`;
    ctx.fillText(numText, FAVICON_SIZE / 2, FAVICON_SIZE * 0.72);
  }

  return canvas.toDataURL('image/png');
}

export function useTabIndicator(positions: LivePosition[]): void {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const linkRef = useRef<HTMLLinkElement | null>(null);

  // Setup and teardown — runs once
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = FAVICON_SIZE;
    canvas.height = FAVICON_SIZE;
    canvasRef.current = canvas;

    const link = document.createElement('link');
    link.rel = 'icon';
    link.setAttribute('data-dynamic', 'true');
    document.head.appendChild(link);
    linkRef.current = link;

    return () => {
      document.title = DEFAULT_TITLE;
      link.remove();
      linkRef.current = null;
      canvasRef.current = null;
    };
  }, []);

  // Update favicon and title when positions change
  useEffect(() => {
    if (!canvasRef.current || !linkRef.current) return;

    const hasPositions = positions.length > 0;
    const totalFloating = hasPositions
      ? positions.reduce((sum, p) => sum + p.profit, 0)
      : null;

    linkRef.current.href = renderFavicon(canvasRef.current, totalFloating);
    document.title = totalFloating !== null
      ? formatCurrencyTitle(totalFloating)
      : NO_POSITION_TITLE;
  }, [positions]);
}
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `head -5 app/hooks/useTabIndicator.ts`
Expected: `'use client';` on line 1, import statements following.

- [ ] **Step 3: Commit**

```bash
git add app/hooks/useTabIndicator.ts
git commit -m "feat: add useTabIndicator hook for dynamic favicon and title"
```

---

### Task 2: Integrate hook into the live page

**Files:**
- Modify: `app/live/page.tsx:7` (add import)
- Modify: `app/live/page.tsx:113` (add hook call)

- [ ] **Step 1: Add import for `useTabIndicator`**

In `app/live/page.tsx`, add this import after the existing `useLiveData` import on line 7:

```ts
import { useTabIndicator } from '../hooks/useTabIndicator';
```

- [ ] **Step 2: Call the hook inside `LivePageContent`**

In `app/live/page.tsx`, inside the `LivePageContent` function, add this line after the `useLiveData` call (after line 113):

```ts
useTabIndicator(liveData.positions);
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build` (or `npx next build`)
Expected: Build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add app/live/page.tsx
git commit -m "feat: integrate tab P&L indicator on live page"
```

---

### Task 3: Manual verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Navigate to `/live` with an active account that has open positions**

Verify:
- The browser tab favicon shows a green or red rounded square with an arrow and rounded P&L value
- The tab title shows the exact P&L (e.g. `+$31.86`)
- The favicon and title update every ~5 seconds as positions are polled

- [ ] **Step 3: Verify no-positions state**

If possible, test with an account that has no open positions:
- Favicon should show a gray square with an em-dash `—`
- Title should show `MT5 Journal`

- [ ] **Step 4: Navigate away from `/live`**

Navigate to another page (e.g. `/`):
- Title should revert to `MT5 Journal - Trading Dashboard`
- Dynamic favicon link should be removed
