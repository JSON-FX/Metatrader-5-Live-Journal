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
