'use client';

import { useState, useEffect, useRef } from 'react';
import { LiveDataState, LiveAccountInfo, LivePosition, LiveTrade } from '../lib/live-types';

const FAST_INTERVAL = 5_000;   // 5s for account, positions, health
const SLOW_INTERVAL = 60_000;  // 60s for trade history
const HISTORY_DAYS = 3650;     // 10 years

export function useLiveData(accountId: string | null): LiveDataState {
  const [state, setState] = useState<LiveDataState>({
    status: 'connecting',
    account: null,
    positions: [],
    history: [],
    lastUpdated: null,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const lastHistory = useRef<LiveTrade[]>([]);

  useEffect(() => {
    setState({
      status: 'connecting',
      account: null,
      positions: [],
      history: [],
      lastUpdated: null,
      error: null,
    });
    lastHistory.current = [];

    if (!accountId) return;

    let fastTimeout: ReturnType<typeof setTimeout>;
    let slowTimeout: ReturnType<typeof setTimeout>;

    const q = `accountId=${encodeURIComponent(accountId)}`;

    async function pollFast() {
      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      try {
        const [healthRes, accountRes, positionsRes] = await Promise.all([
          fetch(`/api/live/health?${q}`, { signal }),
          fetch(`/api/live/account?${q}`, { signal }),
          fetch(`/api/live/positions?${q}`, { signal }),
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

    async function pollHistory() {
      try {
        const res = await fetch(`/api/live/history?${q}&days=${HISTORY_DAYS}`);
        if (res.ok) {
          const history: LiveTrade[] = await res.json();
          lastHistory.current = history;
          setState(prev => ({ ...prev, history }));
        }
      } catch {
        // Keep last known history
      }

      scheduleSlow();
    }

    function scheduleFast() {
      fastTimeout = setTimeout(pollFast, FAST_INTERVAL);
    }

    function scheduleSlow() {
      slowTimeout = setTimeout(pollHistory, SLOW_INTERVAL);
    }

    // Initial load: fetch everything in parallel
    async function init() {
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      try {
        const [healthRes, accountRes, positionsRes, historyRes] = await Promise.all([
          fetch(`/api/live/health?${q}`, { signal }),
          fetch(`/api/live/account?${q}`, { signal }),
          fetch(`/api/live/positions?${q}`, { signal }),
          fetch(`/api/live/history?${q}&days=${HISTORY_DAYS}`, { signal }),
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

        setState({
          status: isOnline ? 'online' : 'offline',
          account,
          positions,
          history,
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

    init();

    return () => {
      clearTimeout(fastTimeout);
      clearTimeout(slowTimeout);
      abortRef.current?.abort();
    };
  }, [accountId]);

  return state;
}
