'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface SettingsContextType {
  timezone: string;
  setTimezone: (tz: string) => void;
  pollingFast: number;
  pollingSlow: number;
  setPollingFast: (seconds: number) => void;
  setPollingSlow: (seconds: number) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  timezone: 'UTC',
  setTimezone: () => {},
  pollingFast: 5,
  pollingSlow: 60,
  setPollingFast: () => {},
  setPollingSlow: () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

function saveSetting(key: string, value: string) {
  fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [key]: value }),
  }).catch(() => {});
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState('UTC');
  const [pollingFast, setPollingFastState] = useState(5);
  const [pollingSlow, setPollingSlowState] = useState(60);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.timezone) setTimezoneState(data.timezone);
        if (data.polling_fast) setPollingFastState(Number(data.polling_fast));
        if (data.polling_slow) setPollingSlowState(Number(data.polling_slow));
      })
      .catch(() => {});
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    saveSetting('timezone', tz);
  }, []);

  const setPollingFast = useCallback((seconds: number) => {
    const val = Math.max(1, seconds);
    setPollingFastState(val);
    saveSetting('polling_fast', String(val));
  }, []);

  const setPollingSlow = useCallback((seconds: number) => {
    const val = Math.max(1, seconds);
    setPollingSlowState(val);
    saveSetting('polling_slow', String(val));
  }, []);

  return (
    <SettingsContext.Provider value={{ timezone, setTimezone, pollingFast, pollingSlow, setPollingFast, setPollingSlow }}>
      {children}
    </SettingsContext.Provider>
  );
}
