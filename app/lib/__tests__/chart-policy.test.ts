import { pickTimeframe, computeWindow } from '../chart-policy';

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;
const WEEK = 7 * DAY;

describe('pickTimeframe', () => {
  test('under 1 hour → M1', () => {
    expect(pickTimeframe(0)).toBe('M1');
    expect(pickTimeframe(59 * 60 * 1000)).toBe('M1');
  });
  test('1h up to 4h → M5', () => {
    expect(pickTimeframe(HOUR)).toBe('M5');
    expect(pickTimeframe(3 * HOUR + 59 * 60 * 1000)).toBe('M5');
  });
  test('4h up to 1d → M15', () => {
    expect(pickTimeframe(4 * HOUR)).toBe('M15');
    expect(pickTimeframe(DAY - 1)).toBe('M15');
  });
  test('1d up to 1w → H1', () => {
    expect(pickTimeframe(DAY)).toBe('H1');
    expect(pickTimeframe(WEEK - 1)).toBe('H1');
  });
  test('1w and longer → D1', () => {
    expect(pickTimeframe(WEEK)).toBe('D1');
    expect(pickTimeframe(4 * WEEK)).toBe('D1');
  });
  test('negative duration clamps to M1', () => {
    expect(pickTimeframe(-1000)).toBe('M1');
  });
});

describe('computeWindow', () => {
  test('20% padding on each side for a 1h trade on M5', () => {
    const open  = 1_000_000;
    const close = open + 60 * 60;            // 1h later
    const w = computeWindow(open, close, 'M5');
    // 20% of 3600s = 720s, but min is 10 * 300s (M5) = 3000s
    expect(w.from).toBe(open  - 3000);
    expect(w.to).toBe(  close + 3000);
  });
  test('minimum padding clamps to 10 × timeframe for very short trades', () => {
    const open  = 1_000_000;
    const close = open + 30;                 // 30 seconds — tiny
    const w = computeWindow(open, close, 'M1');
    // pad = max(6s, 10 * 60s) = 600s
    expect(w.from).toBe(open  - 600);
    expect(w.to).toBe(  close + 600);
  });
  test('D1 trade gets day-sized padding', () => {
    const open  = 1_000_000;
    const close = open + 14 * 24 * 60 * 60;  // 2 weeks
    const w = computeWindow(open, close, 'D1');
    // pad = max(20% of 14d = 2.8d, 10d) = 10d = 864000s
    expect(w.from).toBe(open  - 864000);
    expect(w.to).toBe(  close + 864000);
  });
  test('minimum padding scales with timeframe (D1 uses day-sized min)', () => {
    const open  = 1_000_000;
    const close = open + 60;                          // 60 seconds — short on D1
    const w = computeWindow(open, close, 'D1');
    // pad = max(12s, 10 * 86400s) = 864000s
    expect(w.from).toBe(open  - 864000);
    expect(w.to).toBe(  close + 864000);
  });
});
