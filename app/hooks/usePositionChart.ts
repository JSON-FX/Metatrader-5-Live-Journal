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
