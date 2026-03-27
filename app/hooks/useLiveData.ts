'use client';

import { useState, useEffect, useRef } from 'react';
import { LiveDataState, LiveAccountInfo, LivePosition, LiveTrade } from '../lib/live-types';

const POLL_INTERVAL   = 10_000; // 10s for live data
const HISTORY_INTERVAL = 60_000; // 60s for history (heavier query)

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
  const historyRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHistory = useRef<LiveTrade[]>([]);

  useEffect(() => {
    let liveTimeout: ReturnType<typeof setTimeout>;

    async function fetchHistory() {
      try {
        const res = await fetch(`/api/live/history?days=${historyDays}`);
        if (res.ok) {
          const data: LiveTrade[] = await res.json();
          lastHistory.current = data;
          setState(prev => ({ ...prev, history: data }));
        }
      } catch {
        // history failure is non-fatal; keep last known
      }
      historyRef.current = setTimeout(fetchHistory, HISTORY_INTERVAL);
    }

    async function pollLive() {
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      try {
        const [healthRes, accountRes, positionsRes] = await Promise.all([
          fetch('/api/live/health',    { signal }),
          fetch('/api/live/account',   { signal }),
          fetch('/api/live/positions', { signal }),
        ]);

        if (signal.aborted) return;

        if (!healthRes.ok) {
          setState(prev => ({ ...prev, status: 'offline', error: 'MT5 disconnected' }));
          schedule();
          return;
        }

        const account: LiveAccountInfo | null = accountRes.ok ? await accountRes.json() : null;
        const positions: LivePosition[]       = positionsRes.ok ? await positionsRes.json() : [];

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

      schedule();
    }

    function schedule() {
      liveTimeout = setTimeout(pollLive, POLL_INTERVAL);
    }

    pollLive();
    fetchHistory();

    return () => {
      clearTimeout(liveTimeout);
      if (historyRef.current) clearTimeout(historyRef.current);
      abortRef.current?.abort();
    };
  }, [historyDays]);

  return state;
}
