import { toZonedTime, format as formatTz } from 'date-fns-tz';
import { parseISO } from 'date-fns';

/**
 * Format an ISO 8601 UTC string to the user's timezone in 12-hour format.
 * Output: "yyyy/MM/dd h:mm:ss a" (e.g., "2026/04/04 7:30:01 AM")
 */
export function formatDateTime(isoString: string, timezone: string): string {
  try {
    const date = parseISO(isoString);
    const zonedDate = toZonedTime(date, timezone);
    return formatTz(zonedDate, 'yyyy/MM/dd h:mm:ss a', { timeZone: timezone });
  } catch {
    return isoString;
  }
}

/**
 * Get the YYYY-MM-DD date string for an ISO timestamp in a given timezone.
 * Used for grouping trades by day respecting timezone.
 */
export function getDateInTimezone(isoString: string, timezone: string): string {
  try {
    const date = parseISO(isoString);
    const zonedDate = toZonedTime(date, timezone);
    return formatTz(zonedDate, 'yyyy-MM-dd', { timeZone: timezone });
  } catch {
    return isoString.slice(0, 10);
  }
}

/**
 * Get year and month (0-11) for an ISO timestamp in a given timezone.
 * Used for grouping trades by month respecting timezone.
 */
export function getYearMonthInTimezone(isoString: string, timezone: string): { year: number; month: number } {
  try {
    const date = parseISO(isoString);
    const zonedDate = toZonedTime(date, timezone);
    return {
      year: zonedDate.getFullYear(),
      month: zonedDate.getMonth(),
    };
  } catch {
    return {
      year: parseInt(isoString.slice(0, 4), 10),
      month: parseInt(isoString.slice(5, 7), 10) - 1,
    };
  }
}
