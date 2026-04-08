'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveDataState, LiveAccountInfo, LivePosition, LiveTrade, RawDeal, RawOrder } from '../lib/live-types';

const FAST_INTERVAL = 5_000;   // 5s for account, positions, health
const SLOW_INTERVAL = 60_000;  // 60s for trade history
const HISTORY_DAYS = 3650;     // 10 years

export function useLiveData(accountId: string | null): LiveDataState & { refresh: () => void } {
  const [state, setState] = useState<LiveDataState>({
    status: 'connecting',
    account: null,
    positions: [],
    history: [],
    rawDeals: [],
    rawOrders: [],
    lastUpdated: null,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const lastHistory = useRef<LiveTrade[]>([]);
  const lastRawDeals = useRef<RawDeal[]>([]);
  const lastRawOrders = useRef<RawOrder[]>([]);
  const fastTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const slowTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    setState({
      status: 'connecting',
      account: null,
      positions: [],
      history: [],
      rawDeals: [],
      rawOrders: [],
      lastUpdated: null,
      error: null,
    });
    lastHistory.current = [];
    lastRawDeals.current = [];
    lastRawOrders.current = [];

    if (!accountId) return;

    const q = `accountId=${encodeURIComponent(accountId)}`;

    const noCache = { cache: 'no-store' as const };

    async function pollFast() {
      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      try {
        const [healthRes, accountRes, positionsRes] = await Promise.all([
          fetch(`/api/live/health?${q}`, { signal, ...noCache }),
          fetch(`/api/live/account?${q}`, { signal, ...noCache }),
          fetch(`/api/live/positions?${q}`, { signal, ...noCache }),
        ]);

        if (signal.aborted) return;

        if (!healthRes.ok) {
          setState(prev => ({ ...prev, status: 'offline', error: 'MT5 disconnected' }));
          scheduleFast();
          return;
        }

        const account: LiveAccountInfo | null = accountRes.ok ? await accountRes.json() : null;
        const positions: LivePosition[] = positionsRes.ok ? await positionsRes.json() : [];

        setState(prev => ({
          ...prev,
          status: 'online',
          account,
          positions,
          lastUpdated: new Date(),
          error: null,
        }));
      } catch (err) {
        if (signal.aborted) return;
        setState(prev => ({
          ...prev,
          status: 'offline',
          error: err instanceof Error ? err.message : 'Connection failed',
        }));
      }

      scheduleFast();
    }

    function scheduleFast() {
      fastTimeoutRef.current = setTimeout(pollFast, FAST_INTERVAL);
    }

    function scheduleSlow() {
      slowTimeoutRef.current = setTimeout(pollHistory, SLOW_INTERVAL);
    }

    async function pollHistory() {
      try {
        const [historyRes, dealsRes, ordersRes] = await Promise.all([
          fetch(`/api/live/history?${q}&days=${HISTORY_DAYS}`, noCache),
          fetch(`/api/live/raw-deals?${q}&days=${HISTORY_DAYS}`, noCache),
          fetch(`/api/live/raw-orders?${q}&days=${HISTORY_DAYS}`, noCache),
        ]);

        let history = lastHistory.current;
        let rawDeals = lastRawDeals.current;
        let rawOrders = lastRawOrders.current;

        if (historyRes.ok) {
          history = await historyRes.json();
          lastHistory.current = history;
        }
        if (dealsRes.ok) {
          rawDeals = await dealsRes.json();
          lastRawDeals.current = rawDeals;
        }
        if (ordersRes.ok) {
          rawOrders = await ordersRes.json();
          lastRawOrders.current = rawOrders;
        }

        setState(prev => ({ ...prev, history, rawDeals, rawOrders }));
      } catch {
        // Keep last known data
      }

      scheduleSlow();
    }

    // Initial load: fetch everything in parallel
    async function init() {
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      try {
        const [healthRes, accountRes, positionsRes, historyRes, dealsRes, ordersRes] = await Promise.all([
          fetch(`/api/live/health?${q}`, { signal, ...noCache }),
          fetch(`/api/live/account?${q}`, { signal, ...noCache }),
          fetch(`/api/live/positions?${q}`, { signal, ...noCache }),
          fetch(`/api/live/history?${q}&days=${HISTORY_DAYS}`, { signal, ...noCache }),
          fetch(`/api/live/raw-deals?${q}&days=${HISTORY_DAYS}`, { signal, ...noCache }),
          fetch(`/api/live/raw-orders?${q}&days=${HISTORY_DAYS}`, { signal, ...noCache }),
        ]);

        if (signal.aborted) return;

        const isOnline = healthRes.ok;
        const account: LiveAccountInfo | null = accountRes.ok ? await accountRes.json() : null;
        const positions: LivePosition[] = positionsRes.ok ? await positionsRes.json() : [];

        let history = lastHistory.current;
        if (historyRes.ok) {
          history = await historyRes.json();
          lastHistory.current = history;
        }

        let rawDeals = lastRawDeals.current;
        let rawOrders = lastRawOrders.current;
        if (dealsRes.ok) {
          rawDeals = await dealsRes.json();
          lastRawDeals.current = rawDeals;
        }
        if (ordersRes.ok) {
          rawOrders = await ordersRes.json();
          lastRawOrders.current = rawOrders;
        }

        setState({
          status: isOnline ? 'online' : 'offline',
          account,
          positions,
          history,
          rawDeals,
          rawOrders,
          lastUpdated: new Date(),
          error: isOnline ? null : 'MT5 disconnected',
        });
      } catch (err) {
        if (signal.aborted) return;
        setState(prev => ({
          ...prev,
          status: 'offline',
          error: err instanceof Error ? err.message : 'Connection failed',
        }));
      }

      // Start separate polling loops
      scheduleFast();
      scheduleSlow();
    }

    initRef.current = init;
    init();

    return () => {
      clearTimeout(fastTimeoutRef.current);
      clearTimeout(slowTimeoutRef.current);
      abortRef.current?.abort();
    };
  }, [accountId]);

  const refresh = useCallback(() => {
    clearTimeout(fastTimeoutRef.current);
    clearTimeout(slowTimeoutRef.current);
    abortRef.current?.abort();
    lastHistory.current = [];
    lastRawDeals.current = [];
    lastRawOrders.current = [];
    setState({
      status: 'connecting',
      account: null,
      positions: [],
      history: [],
      rawDeals: [],
      rawOrders: [],
      lastUpdated: null,
      error: null,
    });
    // Small delay to ensure abort is processed before re-fetching
    setTimeout(() => initRef.current?.(), 50);
  }, []);

  return { ...state, refresh };
}
