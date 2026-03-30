# UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use `/frontend-design` skill for all component implementation.

**Goal:** Transform the MetaTrader 5 Journal from a single-page dark-only dashboard into a multi-page Bloomberg Terminal-styled app with light/dark/system theming and two distinct worlds (Live Trading & Backtests).

**Architecture:** Next.js App Router page-based routing with shared component library. CSS custom properties for theming via `next-themes`. Existing data layer (parser, storage, merge, hooks, API routes) stays untouched — only the UI layer changes.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Recharts, Lucide React, next-themes, Geist fonts

**Spec:** `docs/superpowers/specs/2026-03-31-ui-overhaul-design.md`

---

## File Map

### New files to create
- `app/components/shared/Header.tsx` — Shared header with back nav, title, actions slot, ThemeToggle
- `app/components/shared/StatCard.tsx` — Reusable metric card (uppercase label, monospace value, color variant)
- `app/components/shared/DataTable.tsx` — Generic sortable/paginated table with column definitions
- `app/components/shared/EquityChart.tsx` — Recharts AreaChart wrapper (shared between live + backtest)
- `app/components/shared/StatusBadge.tsx` — Small colored pill badge (buy/sell, online/offline, backtest/forward)
- `app/components/shared/EmptyState.tsx` — Centered icon + message + optional CTA
- `app/components/shared/Modal.tsx` — Overlay dialog with backdrop
- `app/components/shared/ThemeToggle.tsx` — Three-state cycle (light/dark/system)
- `app/components/shared/Sparkline.tsx` — Tiny inline SVG line chart for cards
- `app/components/live/LiveAccountPanel.tsx` — Stat cards row for live account
- `app/components/live/OpenPositionsTable.tsx` — DataTable configured for open positions
- `app/components/live/LiveTradesTable.tsx` — DataTable configured for trade history with time filters
- `app/components/live/LiveEquityChart.tsx` — EquityChart configured for live data
- `app/components/backtest/ReportLibrary.tsx` — Grid/list view with sorting for report collection
- `app/components/backtest/ReportCard.tsx` — Card for grid view (symbol, stats, sparkline)
- `app/components/backtest/ReportTabs.tsx` — Tab container with URL param persistence
- `app/components/backtest/ReportOverview.tsx` — Stats grid + equity chart + settings (Tab 1)
- `app/components/backtest/ReportTrades.tsx` — Filter buttons + trades table + trade count chart (Tab 2)
- `app/components/backtest/ReportCalendar.tsx` — Calendar view + win streaks (Tab 3)
- `app/components/backtest/ReportPerformance.tsx` — Yearly grid + risk breakdown (Tab 4)
- `app/components/backtest/ReportUpload.tsx` — Drag-and-drop modal (restyled)
- `app/components/backtest/MergeBar.tsx` — Action bar for merge mode
- `app/live/layout.tsx` — Live section layout with Header
- `app/live/page.tsx` — Live trading dashboard
- `app/backtests/layout.tsx` — Backtests section layout with Header
- `app/backtests/page.tsx` — Report library
- `app/backtests/[id]/page.tsx` — Report detail with tabs

### Files to modify
- `app/layout.tsx` — Add ThemeProvider wrapper from next-themes
- `app/globals.css` — Replace with CSS custom properties for dark/light theming
- `app/page.tsx` — Replace with landing page (two status-aware cards)
- `package.json` — Add next-themes dependency

### Files to delete (after migration)
- `app/components/ReportUpload.tsx`
- `app/components/ReportList.tsx`
- `app/components/ReportStats.tsx`
- `app/components/EquityChart.tsx`
- `app/components/TradesTable.tsx`
- `app/components/TradeCountChart.tsx`
- `app/components/WinstreakCard.tsx`
- `app/components/CalendarView.tsx`
- `app/components/YearlyPerformance.tsx`
- `app/components/LiveAccountPanel.tsx`
- `app/components/OpenPositionsPanel.tsx`
- `app/components/LiveTradesTable.tsx`
- `app/components/LiveEquityChart.tsx`

### Files unchanged
- `app/lib/types.ts`, `app/lib/live-types.ts`, `app/lib/parser.ts`, `app/lib/storage.ts`, `app/lib/merge.ts`
- `app/hooks/useLiveData.ts`
- `app/api/live/health/route.ts`, `app/api/live/account/route.ts`, `app/api/live/positions/route.ts`, `app/api/live/history/route.ts`

---

## Task 1: Install next-themes and set up theme infrastructure

**Files:**
- Modify: `package.json`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Install next-themes**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal && npm install next-themes
```

- [ ] **Step 2: Replace globals.css with theme CSS variables**

Replace the entire contents of `app/globals.css` with:

```css
@import "tailwindcss";

:root {
  /* Light theme (default) */
  --bg-primary: #f1f5f9;
  --bg-secondary: #ffffff;
  --bg-tertiary: #e2e8f0;
  --border: #cbd5e1;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --accent: #2563eb;
  --profit: #16a34a;
  --loss: #dc2626;
  --warning: #d97706;
}

.dark {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  --border: #334155;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --accent: #3b82f6;
  --profit: #22c55e;
  --loss: #ef4444;
  --warning: #f59e0b;
}

@theme inline {
  --color-bg-primary: var(--bg-primary);
  --color-bg-secondary: var(--bg-secondary);
  --color-bg-tertiary: var(--bg-tertiary);
  --color-border: var(--border);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-muted: var(--text-muted);
  --color-accent: var(--accent);
  --color-profit: var(--profit);
  --color-loss: var(--loss);
  --color-warning: var(--warning);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 3: Update layout.tsx with ThemeProvider**

Replace the entire contents of `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MT5 Journal - Trading Dashboard",
  description: "Professional MetaTrader 5 trading journal with live monitoring and backtest analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify the app builds**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal && npm run build
```

Expected: Build succeeds (the landing page will look broken since page.tsx still has old code — that's fine).

- [ ] **Step 5: Commit**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal
git add package.json package-lock.json app/globals.css app/layout.tsx
git commit -m "feat: add next-themes and Bloomberg Terminal theme system"
```

---

## Task 2: Create shared components (ThemeToggle, StatCard, StatusBadge, EmptyState, Modal, Sparkline)

**Files:**
- Create: `app/components/shared/ThemeToggle.tsx`
- Create: `app/components/shared/StatCard.tsx`
- Create: `app/components/shared/StatusBadge.tsx`
- Create: `app/components/shared/EmptyState.tsx`
- Create: `app/components/shared/Modal.tsx`
- Create: `app/components/shared/Sparkline.tsx`

- [ ] **Step 1: Create ThemeToggle component**

Create `app/components/shared/ThemeToggle.tsx`:

```tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  const cycle = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <button
      onClick={cycle}
      className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
      title={`Theme: ${theme}`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
```

- [ ] **Step 2: Create StatCard component**

Create `app/components/shared/StatCard.tsx`:

```tsx
interface StatCardProps {
  label: string;
  value: string;
  secondaryValue?: string;
  variant?: 'default' | 'profit' | 'loss' | 'warning' | 'accent';
}

const variantStyles: Record<string, string> = {
  default: 'text-text-primary',
  profit: 'text-profit',
  loss: 'text-loss',
  warning: 'text-warning',
  accent: 'text-accent',
};

export default function StatCard({ label, value, secondaryValue, variant = 'default' }: StatCardProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <p className="text-[11px] text-text-muted uppercase tracking-[1px] font-sans">{label}</p>
      <p className={`text-xl font-semibold font-mono mt-1 ${variantStyles[variant]}`}>{value}</p>
      {secondaryValue && (
        <p className="text-xs text-text-muted mt-0.5 font-mono">{secondaryValue}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create StatusBadge component**

Create `app/components/shared/StatusBadge.tsx`:

```tsx
type BadgeVariant = 'buy' | 'sell' | 'online' | 'offline' | 'connecting' | 'backtest' | 'forward' | 'live' | 'merged';

const variantStyles: Record<BadgeVariant, string> = {
  buy: 'bg-profit/20 text-profit',
  sell: 'bg-loss/20 text-loss',
  online: 'bg-profit/20 text-profit',
  offline: 'bg-loss/20 text-loss',
  connecting: 'bg-warning/20 text-warning',
  backtest: 'bg-purple-500/20 text-purple-400',
  forward: 'bg-profit/20 text-profit',
  live: 'bg-accent/20 text-accent',
  merged: 'bg-warning/20 text-warning',
};

interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
}

export default function StatusBadge({ label, variant }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Create EmptyState component**

Create `app/components/shared/EmptyState.tsx`:

```tsx
import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="p-4 bg-bg-tertiary rounded-2xl mb-6">
        <Icon className="w-12 h-12 text-text-muted" />
      </div>
      <h2 className="text-2xl font-bold text-text-primary mb-2">{title}</h2>
      {description && (
        <p className="text-text-secondary text-center max-w-md mb-8">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create Modal component**

Create `app/components/shared/Modal.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
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
      <div className="bg-bg-secondary rounded-2xl border border-border w-full max-w-lg">
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

- [ ] **Step 6: Create Sparkline component**

Create `app/components/shared/Sparkline.tsx`:

```tsx
interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export default function Sparkline({ data, color = 'var(--accent)', height = 30, width = 200 }: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const xStep = (width - padding * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = padding + i * xStep;
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${padding + (data.length - 1) * xStep},${height - padding} L ${padding},${height - padding} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, '')})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
```

- [ ] **Step 7: Verify build**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal && npm run build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal
git add app/components/shared/
git commit -m "feat: add shared component library (ThemeToggle, StatCard, StatusBadge, EmptyState, Modal, Sparkline)"
```

---

## Task 3: Create shared Header and DataTable components

**Files:**
- Create: `app/components/shared/Header.tsx`
- Create: `app/components/shared/DataTable.tsx`

- [ ] **Step 1: Create Header component**

Create `app/components/shared/Header.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  title: string;
  backHref?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, backHref, actions }: HeaderProps) {
  return (
    <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            {backHref ? (
              <Link href={backHref} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            ) : (
              <div className="p-1.5">
                <BarChart3 className="w-5 h-5 text-accent" />
              </div>
            )}
            <h1 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create DataTable component**

Create `app/components/shared/DataTable.tsx`:

```tsx
'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  rowKey: (row: T, index: number) => string;
}

export default function DataTable<T>({
  columns,
  data,
  sortable = true,
  pagination = true,
  pageSize = 20,
  emptyMessage = 'No data available',
  rowKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey || !sortable) return data;
    const col = columns.find(c => c.key === sortKey);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, sortable, columns]);

  const totalPages = pagination ? Math.ceil(sorted.length / pageSize) : 1;
  const displayed = pagination ? sorted.slice(page * pageSize, (page + 1) * pageSize) : sorted;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (data.length === 0) {
    return (
      <div className="bg-bg-secondary rounded-xl border border-border p-8 text-center">
        <p className="text-text-muted text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-[11px] font-medium text-text-muted uppercase tracking-[1px] ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.sortable && sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1 hover:text-text-primary transition-colors"
                      style={col.align === 'right' ? { marginLeft: 'auto' } : undefined}
                    >
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-accent" /> : <ChevronDown className="w-3 h-3 text-accent" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.map((row, i) => (
              <tr key={rowKey(row, i)} className="hover:bg-bg-tertiary/50 transition-colors">
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-sm font-mono whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && totalPages > 1 && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-text-muted">
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs rounded bg-bg-tertiary text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-xs rounded bg-bg-tertiary text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal && npm run build
```

- [ ] **Step 4: Commit**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal
git add app/components/shared/Header.tsx app/components/shared/DataTable.tsx
git commit -m "feat: add Header and DataTable shared components"
```

---

## Task 4: Create shared EquityChart component

**Files:**
- Create: `app/components/shared/EquityChart.tsx`

- [ ] **Step 1: Create EquityChart component**

Create `app/components/shared/EquityChart.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface EquityChartProps {
  data: { time: string; value: number }[];
  height?: number;
  showReferenceLine?: boolean;
  referenceValue?: number;
  formatXLabel?: (value: string) => string;
}

interface TooltipPayload {
  time: string;
  value: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TooltipPayload }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-3 shadow-xl">
      <p className="text-xs text-text-muted mb-1">{d.time}</p>
      <p className="text-sm font-mono font-semibold text-text-primary">
        ${d.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

export default function EquityChart({
  data,
  height = 300,
  showReferenceLine = false,
  referenceValue,
  formatXLabel,
}: EquityChartProps) {
  const { minValue, maxValue } = useMemo(() => {
    if (data.length === 0) return { minValue: 0, maxValue: 0 };
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.1, 10);
    return {
      minValue: Math.floor((min - padding) / 10) * 10,
      maxValue: Math.ceil((max + padding) / 10) * 10,
    };
  }, [data]);

  if (data.length < 2) return null;

  const isProfit = data[data.length - 1].value >= data[0].value;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatXLabel}
            stroke="var(--text-muted)"
            fontSize={11}
            fontFamily="var(--font-geist-mono)"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            domain={[minValue, maxValue]}
            tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`}
            stroke="var(--text-muted)"
            fontSize={11}
            fontFamily="var(--font-geist-mono)"
            tickLine={false}
            axisLine={false}
            width={65}
          />
          <Tooltip content={<CustomTooltip />} />
          {showReferenceLine && referenceValue != null && (
            <ReferenceLine
              y={referenceValue}
              stroke="var(--text-muted)"
              strokeDasharray="5 5"
              strokeOpacity={0.5}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={isProfit ? 'var(--profit)' : 'var(--loss)'}
            strokeWidth={2}
            fill="url(#equityGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal
git add app/components/shared/EquityChart.tsx
git commit -m "feat: add shared EquityChart component"
```

---

## Task 5: Build landing page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace page.tsx with landing page**

Replace the entire contents of `app/page.tsx` with:

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, FileText, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { loadReports } from './lib/storage';
import { LiveAccountInfo, LiveStatus } from './lib/live-types';
import ThemeToggle from './components/shared/ThemeToggle';
import Sparkline from './components/shared/Sparkline';
import { BarChart3 } from 'lucide-react';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

function StatusDot({ status }: { status: LiveStatus }) {
  const colors: Record<LiveStatus, string> = {
    connecting: 'bg-warning',
    online: 'bg-profit',
    offline: 'bg-loss',
  };
  const labels: Record<LiveStatus, string> = {
    connecting: 'Connecting',
    online: 'Online',
    offline: 'Offline',
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />
      <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">{labels[status]}</span>
    </div>
  );
}

export default function Home() {
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('connecting');
  const [account, setAccount] = useState<LiveAccountInfo | null>(null);
  const [positionCount, setPositionCount] = useState(0);
  const [equityPoints, setEquityPoints] = useState<number[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const [bestProfit, setBestProfit] = useState<number | null>(null);
  const [profitBars, setProfitBars] = useState<number[]>([]);

  useEffect(() => {
    // Fetch live status (one-time, not polling)
    async function fetchLive() {
      try {
        const [healthRes, accountRes, positionsRes, historyRes] = await Promise.all([
          fetch('/api/live/health'),
          fetch('/api/live/account'),
          fetch('/api/live/positions'),
          fetch('/api/live/history?days=30'),
        ]);

        if (!healthRes.ok) {
          setLiveStatus('offline');
          return;
        }
        setLiveStatus('online');

        if (accountRes.ok) {
          const acc: LiveAccountInfo = await accountRes.json();
          setAccount(acc);
        }
        if (positionsRes.ok) {
          const pos = await positionsRes.json();
          setPositionCount(pos.length);
        }
        if (historyRes.ok) {
          const trades = await historyRes.json();
          // Build equity sparkline from last 20 trades
          if (trades.length > 0) {
            let running = 0;
            const points = trades.slice(-20).map((t: { profit: number }) => {
              running += t.profit;
              return running;
            });
            setEquityPoints(points);
          }
        }
      } catch {
        setLiveStatus('offline');
      }
    }

    // Load backtest stats
    const reports = loadReports();
    setReportCount(reports.length);
    if (reports.length > 0) {
      setLastImport(reports[0].importedAt);
      const best = Math.max(...reports.map(r => r.results.totalNetProfit));
      setBestProfit(best);
      // Profit bars from recent reports (up to 10)
      setProfitBars(reports.slice(0, 10).map(r => r.results.totalNetProfit));
    }

    fetchLive();
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="max-w-3xl mx-auto px-4 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent" />
          <span className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">MT5 Journal</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Cards */}
      <div className="max-w-3xl mx-auto px-4 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Live Trading Card */}
          <Link
            href="/live"
            className="bg-bg-secondary border border-border rounded-lg p-5 hover:border-accent/50 transition-colors group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold text-text-primary">Live Trading</span>
              </div>
              <StatusDot status={liveStatus} />
            </div>

            {liveStatus === 'connecting' && (
              <div className="flex items-center gap-2 text-text-muted text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting...</span>
              </div>
            )}

            {liveStatus === 'offline' && (
              <p className="text-sm text-text-muted py-4">MT5 bridge offline</p>
            )}

            {liveStatus === 'online' && account && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Balance</span>
                  <span className="text-sm font-mono text-text-primary">{formatCurrency(account.balance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Equity</span>
                  <span className="text-sm font-mono text-profit">{formatCurrency(account.equity)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Positions</span>
                  <span className="text-sm font-mono text-text-primary">{positionCount} open</span>
                </div>
                {equityPoints.length > 1 && (
                  <div className="pt-2">
                    <Sparkline data={equityPoints} color="var(--accent)" height={30} />
                  </div>
                )}
              </div>
            )}
          </Link>

          {/* Backtests Card */}
          <Link
            href="/backtests"
            className="bg-bg-secondary border border-border rounded-lg p-5 hover:border-accent/50 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-text-primary">Backtests</span>
            </div>

            {reportCount === 0 ? (
              <p className="text-sm text-text-muted py-4">No reports yet</p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Reports</span>
                  <span className="text-sm font-mono text-text-primary">{reportCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Last Import</span>
                  <span className="text-sm font-mono text-text-primary">
                    {lastImport ? formatDistanceToNow(new Date(lastImport), { addSuffix: true }) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Best Profit</span>
                  <span className="text-sm font-mono text-profit">
                    {bestProfit != null ? formatCurrency(bestProfit) : '—'}
                  </span>
                </div>
                {profitBars.length > 1 && (
                  <div className="flex gap-1 items-end h-[30px] pt-2">
                    {profitBars.map((v, i) => {
                      const max = Math.max(...profitBars.map(Math.abs));
                      const h = max > 0 ? (Math.abs(v) / max) * 100 : 0;
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-sm"
                          style={{
                            height: `${Math.max(h, 8)}%`,
                            backgroundColor: v >= 0 ? 'var(--profit)' : 'var(--loss)',
                            opacity: 0.6,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal
git add app/page.tsx
git commit -m "feat: replace home with status-aware landing page"
```

---

## Task 6: Build live trading dashboard

**Files:**
- Create: `app/live/layout.tsx`
- Create: `app/live/page.tsx`
- Create: `app/components/live/LiveAccountPanel.tsx`
- Create: `app/components/live/OpenPositionsTable.tsx`
- Create: `app/components/live/LiveTradesTable.tsx`
- Create: `app/components/live/LiveEquityChart.tsx`

This task contains 4 component files and 2 route files. Each component reuses the existing logic from the old components but restyled with theme variables and shared components. The implementing agent should use the `/frontend-design` skill and reference the existing component files at `app/components/LiveAccountPanel.tsx`, `app/components/OpenPositionsPanel.tsx`, `app/components/LiveTradesTable.tsx`, and `app/components/LiveEquityChart.tsx` for the data logic, then restyle using theme CSS variables (`bg-bg-secondary`, `text-text-primary`, `text-profit`, `text-loss`, `border-border`, etc.) and shared components (`StatCard`, `StatusBadge`, `DataTable`, `EquityChart`).

- [ ] **Step 1: Create live layout**

Create `app/live/layout.tsx`:

```tsx
import Header from '../components/shared/Header';

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Header title="Live Trading" backHref="/" />
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create LiveAccountPanel**

Create `app/components/live/LiveAccountPanel.tsx`. Port the existing `app/components/LiveAccountPanel.tsx` logic — the `formatCurrency` helper, `startingCapital` calculation from trades, and 5-stat layout — but restyle with theme variables. Use `StatCard` from shared components for each metric. Use `StatusBadge` for the connection status. Replace `bg-zinc-*` classes with `bg-bg-secondary`, `border-border`, `text-text-primary`, `text-profit`, `text-loss` etc.

```tsx
'use client';

import { useMemo } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { LiveAccountInfo, LiveStatus, LiveTrade } from '../../lib/live-types';
import StatCard from '../shared/StatCard';

interface LiveAccountPanelProps {
  status: LiveStatus;
  account: LiveAccountInfo | null;
  lastUpdated: Date | null;
  trades: LiveTrade[];
}

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

function ConnectionStatus({ status }: { status: LiveStatus }) {
  if (status === 'connecting') return (
    <span className="flex items-center gap-1.5 text-xs text-text-muted">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting...
    </span>
  );
  if (status === 'online') return (
    <span className="flex items-center gap-1.5 text-xs text-profit">
      <Wifi className="w-3.5 h-3.5" /> Live
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs text-loss">
      <WifiOff className="w-3.5 h-3.5" /> Offline
    </span>
  );
}

export default function LiveAccountPanel({ status, account, lastUpdated, trades }: LiveAccountPanelProps) {
  const currency = account?.currency ?? 'USD';

  const startingCapital = useMemo(() => {
    if (!account) return null;
    const totalPnl = trades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    return account.balance - totalPnl;
  }, [account, trades]);

  return (
    <div className="bg-bg-secondary rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Account Overview</h2>
          {account && (
            <p className="text-xs text-text-muted mt-0.5">#{account.login} · {account.server}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <ConnectionStatus status={status} />
          {lastUpdated && (
            <span className="text-xs text-text-muted font-mono">{lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {status === 'offline' && !account && (
        <div className="flex items-center gap-3 text-text-muted py-4">
          <WifiOff className="w-5 h-5 shrink-0" />
          <p className="text-sm">MT5 bridge offline. Start the VPS bridge to see live data.</p>
        </div>
      )}

      {account && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {startingCapital != null && (
            <StatCard label="Starting Capital" value={formatCurrency(startingCapital, currency)} />
          )}
          <StatCard label="Balance" value={formatCurrency(account.balance, currency)} />
          <StatCard label="Equity" value={formatCurrency(account.equity, currency)} />
          <StatCard
            label="Floating P/L"
            value={formatCurrency(account.floating_pnl, currency)}
            variant={account.floating_pnl >= 0 ? 'profit' : 'loss'}
          />
          <StatCard
            label="Drawdown"
            value={`${account.drawdown_pct.toFixed(2)}%`}
            secondaryValue={`Free margin: ${formatCurrency(account.free_margin, currency)}`}
            variant={account.drawdown_pct > 3 ? 'warning' : 'default'}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create OpenPositionsTable**

Create `app/components/live/OpenPositionsTable.tsx`. Port `app/components/OpenPositionsPanel.tsx` logic. Use `DataTable` with column definitions. Use `StatusBadge` for buy/sell type badges.

```tsx
'use client';

import { formatDistanceToNow, parseISO } from 'date-fns';
import { LivePosition } from '../../lib/live-types';
import DataTable, { Column } from '../shared/DataTable';
import StatusBadge from '../shared/StatusBadge';

interface OpenPositionsTableProps {
  positions: LivePosition[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

const columns: Column<LivePosition>[] = [
  { key: 'symbol', label: 'Symbol', render: (r) => <span className="text-text-primary font-medium">{r.symbol}</span>, sortable: true, sortValue: (r) => r.symbol },
  { key: 'type', label: 'Type', render: (r) => <StatusBadge label={r.type.toUpperCase()} variant={r.type === 'buy' ? 'buy' : 'sell'} />, sortable: true, sortValue: (r) => r.type },
  { key: 'volume', label: 'Volume', render: (r) => <span className="text-text-secondary">{r.volume.toFixed(2)}</span>, sortable: true, sortValue: (r) => r.volume, align: 'right' },
  { key: 'open_price', label: 'Open', render: (r) => <span className="text-text-secondary">{r.open_price.toFixed(5)}</span>, align: 'right' },
  { key: 'current_price', label: 'Current', render: (r) => <span className="text-text-secondary">{r.current_price.toFixed(5)}</span>, align: 'right' },
  { key: 'sl_tp', label: 'SL / TP', render: (r) => (
    <span className="text-xs">
      <span className="text-loss">{r.sl ? r.sl.toFixed(5) : '—'}</span>
      {' / '}
      <span className="text-profit">{r.tp ? r.tp.toFixed(5) : '—'}</span>
    </span>
  ) },
  { key: 'profit', label: 'P/L', render: (r) => (
    <span className={`font-semibold ${r.profit >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(r.profit)}</span>
  ), sortable: true, sortValue: (r) => r.profit, align: 'right' },
  { key: 'open_time', label: 'Opened', render: (r) => {
    try { return <span className="text-text-muted text-xs">{formatDistanceToNow(parseISO(r.open_time), { addSuffix: true })}</span>; }
    catch { return <span className="text-text-muted text-xs">{r.open_time}</span>; }
  } },
];

export default function OpenPositionsTable({ positions }: OpenPositionsTableProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Open Positions</h2>
        <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-1 rounded font-mono">{positions.length} open</span>
      </div>
      <DataTable
        columns={columns}
        data={positions}
        pagination={false}
        emptyMessage="No open positions"
        rowKey={(r) => String(r.ticket)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create LiveTradesTable**

Create `app/components/live/LiveTradesTable.tsx`. Port `app/components/LiveTradesTable.tsx` logic — the day selector, filter buttons, sort, and pagination. Use `DataTable` for the table, but add the day selector and filter controls as custom header content above it.

```tsx
'use client';

import { useState, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { LiveTrade } from '../../lib/live-types';
import DataTable, { Column } from '../shared/DataTable';
import StatusBadge from '../shared/StatusBadge';

interface LiveTradesTableProps {
  trades: LiveTrade[];
  historyDays: number;
  onChangeDays: (days: number) => void;
}

type FilterType = 'all' | 'profit' | 'loss';
const DAY_OPTIONS = [7, 30, 90, 180, 365];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(isoString: string): string {
  try { return format(parseISO(isoString), 'yyyy-MM-dd HH:mm'); }
  catch { return isoString; }
}

export default function LiveTradesTable({ trades, historyDays, onChangeDays }: LiveTradesTableProps) {
  const [filterType, setFilterType] = useState<FilterType>('all');

  const filtered = useMemo(() => {
    if (filterType === 'profit') return trades.filter(t => t.profit > 0);
    if (filterType === 'loss') return trades.filter(t => t.profit < 0);
    return trades;
  }, [trades, filterType]);

  const totalProfit = trades.reduce((s, t) => s + t.profit, 0);
  const winRate = trades.length > 0 ? Math.round((trades.filter(t => t.profit > 0).length / trades.length) * 100) : 0;

  const columns: Column<LiveTrade>[] = [
    { key: 'close_time', label: 'Close Time', render: (r) => <span className="text-text-secondary">{formatDate(r.close_time)}</span>, sortable: true, sortValue: (r) => r.close_time },
    { key: 'symbol', label: 'Symbol', render: (r) => <span className="text-text-primary font-medium">{r.symbol}</span> },
    { key: 'type', label: 'Type', render: (r) => <StatusBadge label={r.type.toUpperCase()} variant={r.type === 'buy' ? 'buy' : 'sell'} />, sortable: true, sortValue: (r) => r.type },
    { key: 'volume', label: 'Volume', render: (r) => <span className="text-text-secondary">{r.volume.toFixed(2)}</span>, sortable: true, sortValue: (r) => r.volume, align: 'right' },
    { key: 'open_price', label: 'Open', render: (r) => <span className="text-text-secondary">{r.open_price.toFixed(5)}</span>, align: 'right' },
    { key: 'close_price', label: 'Close', render: (r) => <span className="text-text-secondary">{r.close_price.toFixed(5)}</span>, align: 'right' },
    { key: 'profit', label: 'Profit', render: (r) => (
      <span className={`font-semibold ${r.profit >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(r.profit)}</span>
    ), sortable: true, sortValue: (r) => r.profit, align: 'right' },
    { key: 'costs', label: 'Comm+Swap', render: (r) => <span className="text-text-muted">{formatCurrency(r.commission + r.swap)}</span>, align: 'right' },
  ];

  return (
    <div>
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Trade History</h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            {filtered.length} trades · Win rate {winRate}% ·{' '}
            <span className={totalProfit >= 0 ? 'text-profit' : 'text-loss'}>
              {formatCurrency(totalProfit)} net
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {DAY_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => onChangeDays(d)}
                className={`px-2.5 py-1.5 text-xs font-mono transition-colors ${
                  historyDays === d ? 'bg-bg-tertiary text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <div className="flex rounded-lg overflow-hidden border border-border">
              {(['all', 'profit', 'loss'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                    filterType === type ? 'bg-bg-tertiary text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage={`No closed trades in the last ${historyDays} days`}
        rowKey={(r, i) => `${r.ticket}-${i}`}
      />
    </div>
  );
}
```

- [ ] **Step 5: Create LiveEquityChart**

Create `app/components/live/LiveEquityChart.tsx`. Port the chart data logic from `app/components/LiveEquityChart.tsx` — the `chartData` memo that builds running balance from sorted trades — but render using shared `EquityChart`.

```tsx
'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { LiveTrade } from '../../lib/live-types';
import EquityChart from '../shared/EquityChart';

interface LiveEquityChartProps {
  trades: LiveTrade[];
  balance: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

export default function LiveEquityChart({ trades, balance }: LiveEquityChartProps) {
  const { chartData, startingBalance, totalChange, totalChangePct } = useMemo(() => {
    if (trades.length === 0) return { chartData: [], startingBalance: balance, totalChange: 0, totalChangePct: 0 };

    const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
    const totalPnl = sorted.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    const start = balance - totalPnl;

    const points: { time: string; value: number }[] = [];
    let running = start;
    points.push({ time: format(parseISO(sorted[0].close_time), 'MMM d, yyyy'), value: start });

    sorted.forEach((trade) => {
      running += trade.profit + trade.commission + trade.swap;
      points.push({ time: format(parseISO(trade.close_time), 'MMM d HH:mm'), value: running });
    });

    return {
      chartData: points,
      startingBalance: start,
      totalChange: balance - start,
      totalChangePct: start > 0 ? ((balance - start) / start) * 100 : 0,
    };
  }, [trades, balance]);

  if (chartData.length < 2) return null;

  const isProfit = totalChange >= 0;

  return (
    <div className="bg-bg-secondary rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Equity Curve</h3>
          <p className="text-xs text-text-muted mt-1 font-mono">
            Balance progression from {trades.length} closed trades
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {isProfit ? '+' : ''}{totalChangePct.toFixed(2)}%
          </p>
          <p className={`text-sm font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {isProfit ? '+' : ''}{formatCurrency(totalChange)}
          </p>
        </div>
      </div>
      <EquityChart
        data={chartData}
        showReferenceLine
        referenceValue={startingBalance}
      />
    </div>
  );
}
```

- [ ] **Step 6: Create live page**

Create `app/live/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useLiveData } from '../hooks/useLiveData';
import LiveAccountPanel from '../components/live/LiveAccountPanel';
import OpenPositionsTable from '../components/live/OpenPositionsTable';
import LiveEquityChart from '../components/live/LiveEquityChart';
import LiveTradesTable from '../components/live/LiveTradesTable';

export default function LivePage() {
  const [historyDays, setHistoryDays] = useState(90);
  const liveData = useLiveData(historyDays);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <LiveAccountPanel
        status={liveData.status}
        account={liveData.account}
        lastUpdated={liveData.lastUpdated}
        trades={liveData.history}
      />

      {liveData.positions.length > 0 && (
        <OpenPositionsTable positions={liveData.positions} />
      )}

      {liveData.status === 'online' && liveData.account && (
        <LiveEquityChart trades={liveData.history} balance={liveData.account.balance} />
      )}

      {liveData.status === 'online' && (
        <LiveTradesTable
          trades={liveData.history}
          historyDays={historyDays}
          onChangeDays={setHistoryDays}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 7: Verify build**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal && npm run build
```

- [ ] **Step 8: Commit**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal
git add app/live/ app/components/live/
git commit -m "feat: add live trading dashboard with Bloomberg Terminal styling"
```

---

## Task 7: Build backtest report library

**Files:**
- Create: `app/backtests/layout.tsx`
- Create: `app/backtests/page.tsx`
- Create: `app/components/backtest/ReportLibrary.tsx`
- Create: `app/components/backtest/ReportCard.tsx`
- Create: `app/components/backtest/ReportUpload.tsx`
- Create: `app/components/backtest/MergeBar.tsx`

This task creates the backtest library page with grid/list views, sorting, import, merge mode, and delete. The implementing agent should use the `/frontend-design` skill and reference `app/components/ReportList.tsx` and `app/components/ReportUpload.tsx` for existing logic (merge validation, file upload, localStorage operations), then restyle with theme variables and shared components.

- [ ] **Step 1: Create backtests layout**

Create `app/backtests/layout.tsx`:

```tsx
import Header from '../components/shared/Header';

export default function BacktestsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary">
      {children}
    </div>
  );
}
```

Note: The header is rendered by the page itself since it needs dynamic actions (import button, merge button).

- [ ] **Step 2: Create ReportUpload**

Create `app/components/backtest/ReportUpload.tsx`. Port the upload logic from `app/components/ReportUpload.tsx` — drag/drop handlers, file validation, `parseMT5Report` call — but restyle with theme variables.

```tsx
'use client';

import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { parseMT5Report, readFileAsText } from '../../lib/parser';
import { MT5Report } from '../../lib/types';

interface ReportUploadProps {
  onReportImported: (report: MT5Report) => void;
}

export default function ReportUpload({ onReportImported }: ReportUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      setError('Please upload an HTML file from MetaTrader');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const content = await readFileAsText(file);
      const report = parseMT5Report(content, file.name);
      onReportImported(report);
    } catch {
      setError("Failed to parse the report. Please ensure it's a valid MetaTrader report file.");
    } finally {
      setIsProcessing(false);
    }
  }, [onReportImported]);

  return (
    <div className="w-full">
      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
          isDragging ? 'border-accent bg-accent/10' : 'border-border hover:border-text-muted bg-bg-primary'
        } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input type="file" accept=".html,.htm" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} className="hidden" disabled={isProcessing} />
        <div className="flex flex-col items-center gap-3 p-6">
          {isProcessing ? (
            <>
              <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-muted">Processing report...</p>
            </>
          ) : (
            <>
              <div className={`p-3 rounded-full ${isDragging ? 'bg-accent/20' : 'bg-bg-tertiary'}`}>
                {isDragging ? <FileText className="w-6 h-6 text-accent" /> : <Upload className="w-6 h-6 text-text-muted" />}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-secondary">{isDragging ? 'Drop your report here' : 'Drag & drop your MT5 report'}</p>
                <p className="text-xs text-text-muted mt-1">or click to browse (.html files)</p>
              </div>
            </>
          )}
        </div>
      </label>
      {error && (
        <div className="mt-3 flex items-center gap-2 text-loss text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create ReportCard**

Create `app/components/backtest/ReportCard.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { MT5Report } from '../../lib/types';
import StatusBadge from '../shared/StatusBadge';
import Sparkline from '../shared/Sparkline';

interface ReportCardProps {
  report: MT5Report;
  onDelete: (id: string) => void;
  mergeMode?: boolean;
  isSelectedForMerge?: boolean;
  isMergeDisabled?: boolean;
  onToggleMerge?: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

function getSymbol(report: MT5Report): string {
  return report.settings.symbol.replace('_tickstory', '').toUpperCase();
}

function getTypeBadge(report: MT5Report): { label: string; variant: 'backtest' | 'forward' | 'merged' } {
  if (report.type === 'merged') return { label: 'Merged', variant: 'merged' };
  if (report.type === 'forward') return { label: 'Forward', variant: 'forward' };
  return { label: 'Backtest', variant: 'backtest' };
}

export default function ReportCard({ report, onDelete, mergeMode, isSelectedForMerge, isMergeDisabled, onToggleMerge }: ReportCardProps) {
  const symbol = getSymbol(report);
  const badge = getTypeBadge(report);
  const isProfit = report.results.totalNetProfit >= 0;
  const equityPoints = report.deals
    .filter(d => d.balance > 0)
    .map(d => d.balance);

  const dateRange = (() => {
    const closingDeals = report.deals.filter(d => d.direction === 'out' && d.symbol);
    if (closingDeals.length === 0) return '';
    const first = closingDeals[0].time.split(' ')[0].replace(/[\/\.]/g, '-');
    const last = closingDeals[closingDeals.length - 1].time.split(' ')[0].replace(/[\/\.]/g, '-');
    try {
      return `${format(parseISO(first), 'MMM yyyy')} — ${format(parseISO(last), 'MMM yyyy')}`;
    } catch {
      return `${first} — ${last}`;
    }
  })();

  const content = (
    <div className={`bg-bg-secondary border rounded-lg p-4 transition-colors group relative ${
      mergeMode
        ? isSelectedForMerge ? 'border-warning' : isMergeDisabled ? 'border-border opacity-40 cursor-not-allowed' : 'border-border hover:border-warning/50 cursor-pointer'
        : 'border-border hover:border-accent/50'
    }`}>
      {/* Merge checkbox */}
      {mergeMode && (
        <div className={`absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center ${
          isSelectedForMerge ? 'bg-warning border-warning' : 'border-border'
        }`}>
          {isSelectedForMerge && <span className="text-white text-xs font-bold">✓</span>}
        </div>
      )}

      {/* Delete button (non-merge mode) */}
      {!mergeMode && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(report.id); }}
          className="absolute top-3 right-3 p-1.5 text-text-muted hover:text-loss hover:bg-loss/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{symbol}</h3>
        <StatusBadge label={badge.label} variant={badge.variant} />
      </div>

      <p className="text-xs text-text-muted mb-3 font-mono">{dateRange}</p>

      <p className={`text-xl font-bold font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
        {formatCurrency(report.results.totalNetProfit)}
      </p>

      <div className="flex items-center gap-3 mt-2 text-xs text-text-muted font-mono">
        <span>PF {report.results.profitFactor.toFixed(2)}</span>
        <span>{report.tradeStats.totalTrades} trades</span>
      </div>

      {equityPoints.length > 2 && (
        <div className="mt-3">
          <Sparkline
            data={equityPoints}
            color={isProfit ? 'var(--profit)' : 'var(--loss)'}
            height={24}
          />
        </div>
      )}
    </div>
  );

  if (mergeMode) {
    return (
      <div onClick={() => { if (!isMergeDisabled && onToggleMerge) onToggleMerge(report.id); }}>
        {content}
      </div>
    );
  }

  return <Link href={`/backtests/${report.id}`}>{content}</Link>;
}
```

- [ ] **Step 4: Create MergeBar**

Create `app/components/backtest/MergeBar.tsx`:

```tsx
'use client';

import { GitMerge } from 'lucide-react';

interface MergeBarProps {
  selectedCount: number;
  canMerge: boolean;
  error: string | null;
  onMerge: () => void;
}

export default function MergeBar({ selectedCount, canMerge, error, onMerge }: MergeBarProps) {
  return (
    <div className="bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitMerge className="w-5 h-5 text-warning" />
          <span className="text-sm text-warning">Select 2+ reports with the same symbol to merge</span>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-loss">{error}</span>}
          <button
            onClick={onMerge}
            disabled={!canMerge}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              canMerge ? 'bg-warning hover:opacity-90 text-white' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
            }`}
          >
            Merge Selected ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create ReportLibrary**

Create `app/components/backtest/ReportLibrary.tsx`:

```tsx
'use client';

import { useState, useMemo } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { MT5Report } from '../../lib/types';
import ReportCard from './ReportCard';
import DataTable, { Column } from '../shared/DataTable';
import StatusBadge from '../shared/StatusBadge';
import Sparkline from '../shared/Sparkline';
import Link from 'next/link';

interface ReportLibraryProps {
  reports: MT5Report[];
  onDelete: (id: string) => void;
  mergeMode: boolean;
  selectedForMerge: string[];
  onToggleMerge: (id: string) => void;
}

type SortOption = 'date' | 'profit' | 'symbol';
type ViewMode = 'grid' | 'list';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

function getSymbol(report: MT5Report): string {
  return report.settings.symbol.replace('_tickstory', '').toUpperCase();
}

export default function ReportLibrary({ reports, onDelete, mergeMode, selectedForMerge, onToggleMerge }: ReportLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('date');

  const firstSelectedSymbol = selectedForMerge.length > 0
    ? getSymbol(reports.find(r => r.id === selectedForMerge[0])!)
    : null;

  const sorted = useMemo(() => {
    const list = [...reports];
    switch (sortBy) {
      case 'profit': return list.sort((a, b) => b.results.totalNetProfit - a.results.totalNetProfit);
      case 'symbol': return list.sort((a, b) => getSymbol(a).localeCompare(getSymbol(b)));
      default: return list; // already sorted by import date
    }
  }, [reports, sortBy]);

  const listColumns: Column<MT5Report>[] = [
    { key: 'symbol', label: 'Symbol', render: (r) => (
      <Link href={`/backtests/${r.id}`} className="text-text-primary font-medium hover:text-accent">{getSymbol(r)}</Link>
    ), sortable: true, sortValue: (r) => getSymbol(r) },
    { key: 'type', label: 'Type', render: (r) => {
      const v = r.type === 'merged' ? 'merged' : r.type === 'forward' ? 'forward' : 'backtest';
      return <StatusBadge label={v.charAt(0).toUpperCase() + v.slice(1)} variant={v as 'backtest' | 'forward' | 'merged'} />;
    } },
    { key: 'profit', label: 'Net Profit', render: (r) => (
      <span className={`font-semibold ${r.results.totalNetProfit >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(r.results.totalNetProfit)}</span>
    ), sortable: true, sortValue: (r) => r.results.totalNetProfit, align: 'right' },
    { key: 'pf', label: 'Profit Factor', render: (r) => <span className="text-text-secondary">{r.results.profitFactor.toFixed(2)}</span>, sortable: true, sortValue: (r) => r.results.profitFactor, align: 'right' },
    { key: 'trades', label: 'Trades', render: (r) => <span className="text-text-secondary">{r.tradeStats.totalTrades}</span>, sortable: true, sortValue: (r) => r.tradeStats.totalTrades, align: 'right' },
    { key: 'winrate', label: 'Win Rate', render: (r) => <span className="text-text-secondary">{r.tradeStats.profitTradesPercent.toFixed(1)}%</span>, sortable: true, sortValue: (r) => r.tradeStats.profitTradesPercent, align: 'right' },
  ];

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-xs bg-bg-tertiary text-text-secondary border border-border rounded-lg px-3 py-1.5"
          >
            <option value="date">Date Imported</option>
            <option value="profit">Profit (High-Low)</option>
            <option value="symbol">Symbol (A-Z)</option>
          </select>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 ${viewMode === 'grid' ? 'bg-bg-tertiary text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 ${viewMode === 'list' ? 'bg-bg-tertiary text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              onDelete={onDelete}
              mergeMode={mergeMode}
              isSelectedForMerge={selectedForMerge.includes(report.id)}
              isMergeDisabled={mergeMode && !!firstSelectedSymbol && getSymbol(report) !== firstSelectedSymbol && !selectedForMerge.includes(report.id)}
              onToggleMerge={onToggleMerge}
            />
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <DataTable
          columns={listColumns}
          data={sorted}
          rowKey={(r) => r.id}
          emptyMessage="No reports"
          pagination={false}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create backtests page**

Create `app/backtests/page.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, GitMerge, FileText } from 'lucide-react';
import { MT5Report } from '../lib/types';
import { loadReports, deleteReport, addReport } from '../lib/storage';
import { mergeReports, canMergeReports } from '../lib/merge';
import Header from '../components/shared/Header';
import Modal from '../components/shared/Modal';
import EmptyState from '../components/shared/EmptyState';
import ReportLibrary from '../components/backtest/ReportLibrary';
import ReportUpload from '../components/backtest/ReportUpload';
import MergeBar from '../components/backtest/MergeBar';

export default function BacktestsPage() {
  const [reports, setReports] = useState<MT5Report[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Merge state
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [showMergeNameModal, setShowMergeNameModal] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [mergeError, setMergeError] = useState<string | null>(null);

  useEffect(() => {
    setReports(loadReports());
    setIsLoaded(true);
  }, []);

  const handleReportImported = useCallback((report: MT5Report) => {
    setReports(addReport(report));
    setShowUploadModal(false);
  }, []);

  const handleDeleteReport = useCallback((id: string) => {
    setReports(deleteReport(id));
  }, []);

  const handleToggleMerge = useCallback((id: string) => {
    setSelectedForMerge(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    setMergeError(null);
  }, []);

  const handleInitiateMerge = useCallback(() => {
    const selected = reports.filter(r => selectedForMerge.includes(r.id));
    const { canMerge, reason } = canMergeReports(selected);
    if (!canMerge) { setMergeError(reason || 'Cannot merge'); return; }
    const symbols = [...new Set(selected.map(r => r.settings.symbol.replace('_tickstory', '')))];
    setMergeName(`${symbols[0]} Merged (${selected.length} reports)`);
    setShowMergeNameModal(true);
  }, [reports, selectedForMerge]);

  const handleConfirmMerge = useCallback(() => {
    try {
      const selected = reports.filter(r => selectedForMerge.includes(r.id));
      const merged = mergeReports(selected, mergeName || 'Merged Report');
      setReports(addReport(merged));
      setMergeMode(false);
      setSelectedForMerge([]);
      setShowMergeNameModal(false);
      setMergeName('');
      setMergeError(null);
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Failed to merge');
    }
  }, [reports, selectedForMerge, mergeName]);

  const selectedReportsForMerge = reports.filter(r => selectedForMerge.includes(r.id));
  const { canMerge } = canMergeReports(selectedReportsForMerge);

  if (!isLoaded) return null;

  return (
    <>
      <Header
        title="Backtests"
        backHref="/"
        actions={
          <div className="flex items-center gap-2">
            {reports.length >= 2 && (
              <button
                onClick={() => { setMergeMode(prev => !prev); setSelectedForMerge([]); setMergeError(null); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  mergeMode ? 'bg-warning text-white' : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                }`}
              >
                <GitMerge className="w-3.5 h-3.5" />
                {mergeMode ? 'Cancel' : 'Merge'}
              </button>
            )}
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              Import Report
            </button>
          </div>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {mergeMode && (
          <MergeBar
            selectedCount={selectedForMerge.length}
            canMerge={canMerge}
            error={mergeError}
            onMerge={handleInitiateMerge}
          />
        )}

        {reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Reports Yet"
            description="Import your MetaTrader backtest or forward test reports to analyze your trading performance."
            action={{ label: 'Import Report', onClick: () => setShowUploadModal(true) }}
          />
        ) : (
          <ReportLibrary
            reports={reports}
            onDelete={handleDeleteReport}
            mergeMode={mergeMode}
            selectedForMerge={selectedForMerge}
            onToggleMerge={handleToggleMerge}
          />
        )}
      </main>

      {/* Upload Modal */}
      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)} title="Import Report">
        <ReportUpload onReportImported={handleReportImported} />
        <p className="text-xs text-text-muted mt-4 text-center">Supports MetaTrader 5 Strategy Tester HTML reports</p>
      </Modal>

      {/* Merge Name Modal */}
      <Modal open={showMergeNameModal} onClose={() => { setShowMergeNameModal(false); setMergeName(''); }} title="Name Merged Report">
        <label className="block text-sm text-text-secondary mb-2">Report Name</label>
        <input
          type="text"
          value={mergeName}
          onChange={(e) => setMergeName(e.target.value)}
          placeholder="Enter a name for the merged report"
          className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent font-mono"
          autoFocus
        />
        <p className="text-xs text-text-muted mt-2">Merging {selectedForMerge.length} reports</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { setShowMergeNameModal(false); setMergeName(''); }}
            className="flex-1 px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg text-sm font-medium hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmMerge}
            disabled={!mergeName.trim()}
            className="flex-1 px-4 py-2 bg-warning text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Merged Report
          </button>
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 7: Verify build**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal && npm run build
```

- [ ] **Step 8: Commit**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal
git add app/backtests/ app/components/backtest/ReportLibrary.tsx app/components/backtest/ReportCard.tsx app/components/backtest/ReportUpload.tsx app/components/backtest/MergeBar.tsx
git commit -m "feat: add backtest report library with grid/list views, merge, and import"
```

---

## Task 8: Build single report view with tabs

**Files:**
- Create: `app/backtests/[id]/page.tsx`
- Create: `app/components/backtest/ReportTabs.tsx`
- Create: `app/components/backtest/ReportOverview.tsx`
- Create: `app/components/backtest/ReportTrades.tsx`
- Create: `app/components/backtest/ReportCalendar.tsx`
- Create: `app/components/backtest/ReportPerformance.tsx`

This task creates the tabbed report detail view. Each tab component ports logic from an existing component and restyles it with theme variables. The implementing agent should use the `/frontend-design` skill and reference:
- `app/components/ReportStats.tsx` → `ReportOverview.tsx` (stats grid + settings)
- `app/components/EquityChart.tsx` → used via shared `EquityChart`
- `app/components/TradesTable.tsx` → `ReportTrades.tsx` (trade grouping + filter + table)
- `app/components/TradeCountChart.tsx` → included in `ReportTrades.tsx`
- `app/components/CalendarView.tsx` → `ReportCalendar.tsx` (calendar + navigation)
- `app/components/WinstreakCard.tsx` → included in `ReportCalendar.tsx`
- `app/components/YearlyPerformance.tsx` → `ReportPerformance.tsx` (yearly grid)

- [ ] **Step 1: Create ReportTabs**

Create `app/components/backtest/ReportTabs.tsx`:

```tsx
'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'trades', label: 'Trades' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'performance', label: 'Performance' },
] as const;

type TabKey = typeof TABS[number]['key'];

interface ReportTabsProps {
  children: Record<TabKey, React.ReactNode>;
}

export default function ReportTabs({ children }: ReportTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get('tab') as TabKey) || 'overview';

  const setTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div>
      <div className="flex border-b border-border mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`px-4 py-2.5 text-xs font-medium uppercase tracking-[1px] transition-colors border-b-2 -mb-[1px] ${
              activeTab === tab.key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children[activeTab]}
    </div>
  );
}
```

- [ ] **Step 2: Create ReportOverview**

Create `app/components/backtest/ReportOverview.tsx`. Port stat grid logic from `app/components/ReportStats.tsx` — all the metric calculations, risk analysis, streak analysis, trade breakdown, P/L summary, and strategy settings sections. Restyle with theme variables and `StatCard`.

```tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { MT5Report } from '../../lib/types';
import StatCard from '../shared/StatCard';
import EquityChart from '../shared/EquityChart';

interface ReportOverviewProps {
  report: MT5Report;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

export default function ReportOverview({ report }: ReportOverviewProps) {
  const { results, tradeStats, settings } = report;
  const [showSettings, setShowSettings] = useState(false);

  const netProfitPercent = (results.totalNetProfit / settings.initialDeposit) * 100;
  const highestDD = Math.max(results.balanceDrawdownMaximalPercent, results.equityDrawdownMaximalPercent);

  // Build equity chart data from deals
  const chartData = (() => {
    const points: { time: string; value: number }[] = [];
    let running = settings.initialDeposit;
    if (report.deals.length > 0) {
      points.push({ time: report.deals[0].time.split(' ')[0].replace(/[\/\.]/g, '-'), value: running });
    }
    for (const deal of report.deals) {
      if (deal.balance > 0) {
        running = deal.balance;
        points.push({ time: deal.time.replace(/[\/\.]/g, '-'), value: deal.balance });
      }
    }
    if (points.length === 0 && report.equityCurve.length > 0) {
      return report.equityCurve.map(p => ({ time: p.date, value: p.balance }));
    }
    return points;
  })();

  const hasInputs = Object.keys(settings.inputs).filter(k => !k.startsWith('_')).length > 0;

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Net Profit" value={formatCurrency(results.totalNetProfit)} secondaryValue={`${netProfitPercent >= 0 ? '+' : ''}${netProfitPercent.toFixed(2)}%`} variant={results.totalNetProfit >= 0 ? 'profit' : 'loss'} />
        <StatCard label="Profit Factor" value={results.profitFactor.toFixed(2)} secondaryValue={results.profitFactor >= 1.5 ? 'Good' : results.profitFactor >= 1 ? 'Marginal' : 'Poor'} />
        <StatCard label="Total Trades" value={String(tradeStats.totalTrades)} secondaryValue={`${tradeStats.profitTrades}W / ${tradeStats.lossTrades}L`} />
        <StatCard label="Win Rate" value={`${tradeStats.profitTradesPercent.toFixed(1)}%`} secondaryValue={`${tradeStats.profitTrades} of ${tradeStats.totalTrades}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Expected Payoff" value={formatCurrency(results.expectedPayoff)} variant={results.expectedPayoff >= 0 ? 'profit' : 'loss'} />
        <StatCard label="Sharpe Ratio" value={results.sharpeRatio.toFixed(2)} secondaryValue={results.sharpeRatio >= 2 ? 'Excellent' : results.sharpeRatio >= 1 ? 'Good' : 'Moderate'} />
        <StatCard label="Max Drawdown" value={`-${highestDD.toFixed(2)}%`} variant="loss" />
        <StatCard label="Recovery Factor" value={results.recoveryFactor.toFixed(2)} secondaryValue="Net profit / Max DD" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Gross Profit" value={formatCurrency(results.grossProfit)} variant="profit" />
        <StatCard label="Gross Loss" value={formatCurrency(results.grossLoss)} variant="loss" />
        <StatCard label="Avg Win" value={formatCurrency(tradeStats.averageProfitTrade)} variant="profit" />
        <StatCard label="Avg Loss" value={formatCurrency(tradeStats.averageLossTrade)} variant="loss" />
      </div>

      {/* Equity chart */}
      {chartData.length >= 2 && (
        <div className="bg-bg-secondary rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px] mb-4">Equity Curve</h3>
          <EquityChart data={chartData} showReferenceLine referenceValue={settings.initialDeposit} />
        </div>
      )}

      {/* Strategy Settings (collapsible) */}
      {hasInputs && (
        <div className="bg-bg-secondary rounded-xl border border-border">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between p-4 hover:bg-bg-tertiary/30 transition-colors rounded-xl"
          >
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Strategy Settings</h3>
            {showSettings ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
          </button>
          {showSettings && (
            <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Symbol</p>
                <p className="text-sm text-text-primary font-mono mt-1">{settings.symbol}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Period</p>
                <p className="text-sm text-text-primary font-mono mt-1">{settings.period}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Initial Deposit</p>
                <p className="text-sm text-text-primary font-mono mt-1">{formatCurrency(settings.initialDeposit)}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Leverage</p>
                <p className="text-sm text-text-primary font-mono mt-1">{settings.leverage}</p>
              </div>
              {Object.entries(settings.inputs).filter(([k]) => !k.startsWith('_')).map(([key, value]) => (
                <div key={key}>
                  <p className="text-[10px] text-text-muted uppercase tracking-[0.5px]">{key}</p>
                  <p className="text-sm text-text-primary font-mono mt-1">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create ReportTrades**

Create `app/components/backtest/ReportTrades.tsx`. Port `groupDealsIntoTrades` and the filter/sort logic from `app/components/TradesTable.tsx`. Port the trade count chart SVG from `app/components/TradeCountChart.tsx`. Use `DataTable` for the trades table. Restyle with theme variables.

The implementing agent should read `app/components/TradesTable.tsx` (lines 42-90 for `groupDealsIntoTrades`) and `app/components/TradeCountChart.tsx` (the SVG path generation) and combine them into this single component.

- [ ] **Step 4: Create ReportCalendar**

Create `app/components/backtest/ReportCalendar.tsx`. Port the calendar grid rendering, daily P/L calculation, week totals, and month navigation from `app/components/CalendarView.tsx`. Port the win streak calculation from `app/components/WinstreakCard.tsx`. Replace the custom `FireIcon` SVG with Lucide's `Flame` icon. Restyle with theme variables.

The implementing agent should read `app/components/CalendarView.tsx` (full file) and `app/components/WinstreakCard.tsx` (full file) and combine them.

- [ ] **Step 5: Create ReportPerformance**

Create `app/components/backtest/ReportPerformance.tsx`. Port the yearly/monthly grid and display mode toggle from `app/components/YearlyPerformance.tsx`. Port the risk analysis section from `app/components/ReportStats.tsx` (lines 65-98 for risk calculations, lines 170-226 for the risk metrics grid). Restyle with theme variables.

The implementing agent should read `app/components/YearlyPerformance.tsx` (full file) and `app/components/ReportStats.tsx` (lines 65-98 and 170-226) and combine them.

- [ ] **Step 6: Create report detail page**

Create `app/backtests/[id]/page.tsx`:

```tsx
'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadReports } from '../../lib/storage';
import { MT5Report } from '../../lib/types';
import Header from '../../components/shared/Header';
import ReportTabs from '../../components/backtest/ReportTabs';
import ReportOverview from '../../components/backtest/ReportOverview';
import ReportTrades from '../../components/backtest/ReportTrades';
import ReportCalendar from '../../components/backtest/ReportCalendar';
import ReportPerformance from '../../components/backtest/ReportPerformance';

function getSymbol(report: MT5Report): string {
  return report.settings.symbol.replace('_tickstory', '').toUpperCase();
}

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [report, setReport] = useState<MT5Report | null>(null);

  useEffect(() => {
    const reports = loadReports();
    const found = reports.find(r => r.id === id);
    if (!found) {
      router.replace('/backtests');
      return;
    }
    setReport(found);
  }, [id, router]);

  if (!report) return null;

  const title = `${getSymbol(report)} — ${report.name}`;

  return (
    <>
      <Header title={title} backHref="/backtests" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ReportTabs>
          {{
            overview: <ReportOverview report={report} />,
            trades: <ReportTrades report={report} />,
            calendar: <ReportCalendar report={report} />,
            performance: <ReportPerformance report={report} />,
          }}
        </ReportTabs>
      </main>
    </>
  );
}
```

- [ ] **Step 7: Verify build**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal && npm run build
```

- [ ] **Step 8: Commit**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal
git add app/backtests/\[id\]/ app/components/backtest/ReportTabs.tsx app/components/backtest/ReportOverview.tsx app/components/backtest/ReportTrades.tsx app/components/backtest/ReportCalendar.tsx app/components/backtest/ReportPerformance.tsx
git commit -m "feat: add report detail view with tabbed navigation"
```

---

## Task 9: Clean up old components and verify

**Files:**
- Delete: All 13 files in `app/components/` (old components)

- [ ] **Step 1: Delete old components**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal
rm app/components/ReportUpload.tsx
rm app/components/ReportList.tsx
rm app/components/ReportStats.tsx
rm app/components/EquityChart.tsx
rm app/components/TradesTable.tsx
rm app/components/TradeCountChart.tsx
rm app/components/WinstreakCard.tsx
rm app/components/CalendarView.tsx
rm app/components/YearlyPerformance.tsx
rm app/components/LiveAccountPanel.tsx
rm app/components/OpenPositionsPanel.tsx
rm app/components/LiveTradesTable.tsx
rm app/components/LiveEquityChart.tsx
```

- [ ] **Step 2: Verify clean build**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal && npm run build
```

Expected: Build succeeds with no import errors. If any old imports remain, fix them.

- [ ] **Step 3: Run the dev server and visually verify**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal && npm run dev
```

Open `http://localhost:3000` and verify:
1. Landing page shows two status-aware cards
2. Theme toggle cycles light → dark → system
3. `/live` shows the live trading dashboard with all sections
4. `/backtests` shows the report library (grid/list views, import, merge)
5. `/backtests/[id]` shows tabbed report detail (all 4 tabs work)
6. Back navigation works on all pages
7. Light theme and dark theme both look correct (Bloomberg Terminal style)

- [ ] **Step 4: Commit**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal
git add -A
git commit -m "chore: remove old single-page components"
```

---

## Task 10: Final polish and visual QA

- [ ] **Step 1: Test with dev server running**

Open each page in both light and dark themes. Check:
- All text is readable (no white-on-white or dark-on-dark)
- Charts render correctly in both themes
- Tables are styled consistently
- Buttons and interactive elements have visible hover states
- Mobile responsive: cards stack, tables scroll horizontally

- [ ] **Step 2: Fix any visual issues found**

Apply CSS or component fixes as needed.

- [ ] **Step 3: Final commit**

```bash
cd /Users/jsonse/Documents/development/metatrader-journal
git add -A
git commit -m "fix: visual polish and theme consistency"
```
