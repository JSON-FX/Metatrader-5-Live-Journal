'use client';

import { useState, useEffect, useRef } from 'react';
import { LiveDataState, LiveAccountInfo, LivePosition, LiveTrade } from '../lib/live-types';

const POLL_INTERVAL = 5_000; // 5s for live data (account, positions, history)

export function useLiveData(historyDays = 90): LiveDataState {
  const [state, setState] = useState<LiveDataState>({
    status: 'connecting',
    account: null,
    positions: [],
    history: [],
    lastUpdated: null,
    error: null,
  });

  const abortRef    = useRef<AbortController | null>(null);
  const lastHistory = useRef<LiveTrade[]>([]);

  useEffect(() => {
    let liveTimeout: ReturnType<typeof setTimeout>;

    async function pollLive() {
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      try {
        const [healthRes, accountRes, positionsRes, historyRes] = await Promise.all([
          fetch('/api/live/health',    { signal }),
          fetch('/api/live/account',   { signal }),
          fetch('/api/live/positions', { signal }),
          fetch(`/api/live/history?days=${historyDays}`, { signal }),
        ]);

        if (signal.aborted) return;

        if (!healthRes.ok) {
          setState(prev => ({ ...prev, status: 'offline', error: 'MT5 disconnected' }));
          schedule();
          return;
        }

        const account: LiveAccountInfo | null = accountRes.ok ? await accountRes.json() : null;
        const positions: LivePosition[]       = positionsRes.ok ? await positionsRes.json() : [];

        let history = lastHistory.current;
        if (historyRes.ok) {
          history = await historyRes.json();
          lastHistory.current = history;
        }

        setState(prev => ({
          ...prev,
          status: 'online',
          account,
          positions,
          history,
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

      schedule();
    }

    function schedule() {
      liveTimeout = setTimeout(pollLive, POLL_INTERVAL);
    }

    pollLive();

    return () => {
      clearTimeout(liveTimeout);
      abortRef.current?.abort();
    };
  }, [historyDays]);

  return state;
}
