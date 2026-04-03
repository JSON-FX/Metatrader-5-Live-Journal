'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface SettingsContextType {
  timezone: string;
  setTimezone: (tz: string) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  timezone: 'UTC',
  setTimezone: () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState('UTC');

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.timezone) setTimezoneState(data.timezone);
      })
      .catch(() => {});
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: tz }),
    }).catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </SettingsContext.Provider>
  );
}
