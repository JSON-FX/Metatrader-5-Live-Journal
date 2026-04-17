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
  lastUpdated: Date | null;
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
  // Stable identity key — changes only when the user switches to a different trade/position.
  // Used to key the closeTs memo so it doesn't recompute every poll for open positions.
  const stableKey = input.kind === 'open' ? `open:${input.position.ticket}` : `closed:${input.trade.ticket}`;

  const { symbol, openTs, closeTs } = useMemo(() => {
    if (input.kind === 'open') {
      return {
        symbol:  input.position.symbol,
        openTs:  Math.floor(new Date(input.position.open_time).getTime() / 1000),
        // Snapshot "now" once per ticket. The live-update effect extends beyond this
        // naturally, and the initial window is wide enough (20% padding).
        closeTs: Math.floor(Date.now() / 1000),
      };
    }
    return {
      symbol:  input.trade.symbol,
      openTs:  Math.floor(new Date(input.trade.open_time).getTime() / 1000),
      closeTs: Math.floor(new Date(input.trade.close_time).getTime() / 1000),
    };
    // Only recompute when we switch to a different trade/position (ticket changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey]);

  const timeframe = useMemo(
    () => pickTimeframe((closeTs - openTs) * 1000),
    [closeTs, openTs],
  );
  const range = useMemo(
    () => computeWindow(openTs, closeTs, timeframe),
    [openTs, closeTs, timeframe],
  );

  const [bars, setBars]         = useState<CandleBar[]>([]);
  const [status, setStatus]     = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError]       = useState<string | undefined>();
  const [retryNonce, setRetryNonce] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
        setLastUpdated(new Date());
      })
      .catch((e: { name?: string; status?: number }) => {
        if (e.name === 'AbortError') return;
        setStatus('error');
        setError(errorMessage(e.status ?? 0));
      });

    return () => ctrl.abort();
  }, [accountId, symbol, timeframe, range.from, range.to, retryNonce]);

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
        setLastUpdated(new Date());
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

  return {
    status,
    bars,
    timeframe,
    window: range,
    error,
    retry:  () => setRetryNonce(n => n + 1),
    isStale,
    lastUpdated,
  };
}
