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

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  M1:  60,
  M5:  5 * 60,
  M15: 15 * 60,
  H1:  60 * 60,
  H4:  4 * 60 * 60,
  D1:  24 * 60 * 60,
};

/**
 * Pad a trade window by 20% of its duration on each side, clamped so padding
 * is never smaller than 10 × the timeframe's bar size. Returns UTC unix seconds.
 *
 * @param openTs   Trade open time (unix seconds UTC)
 * @param closeTs  Trade close time OR current time for open positions
 * @param tf       Chosen timeframe (affects the minimum-padding clamp)
 */
export function computeWindow(
  openTs: number,
  closeTs: number,
  tf: Timeframe,
): { from: number; to: number } {
  const duration = Math.max(0, closeTs - openTs);
  const rawPad   = duration * 0.2;
  const minPad   = 10 * TIMEFRAME_SECONDS[tf];
  const pad      = Math.max(Math.round(rawPad), minPad);
  return { from: openTs - pad, to: closeTs + pad };
}
