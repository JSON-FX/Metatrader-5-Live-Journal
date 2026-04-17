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
      sl: null, tp: null,
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
