import type { Timeframe } from './live-types';

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Map a trade's duration (ms) to a sensible candle timeframe.
 * Boundaries are inclusive on the lower end.
 */
export function pickTimeframe(durationMs: number): Timeframe {
  const d = Math.max(0, durationMs);
  if (d < HOUR) return 'M1';
  if (d < 4 * HOUR) return 'M5';
  if (d < DAY) return 'M15';
  if (d < WEEK) return 'H1';
  return 'D1';
}
