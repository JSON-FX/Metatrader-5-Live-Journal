import { pickTimeframe } from '../chart-policy';

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
