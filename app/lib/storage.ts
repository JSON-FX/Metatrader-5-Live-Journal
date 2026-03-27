import { MT5Report } from './types';

const STORAGE_KEY = 'mt5-journal-reports';

export function saveReports(reports: MT5Report[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (error) {
    console.error('Failed to save reports to localStorage:', error);
  }
}

export function loadReports(): MT5Report[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data) as MT5Report[];
    }
  } catch (error) {
    console.error('Failed to load reports from localStorage:', error);
  }
  return [];
}

export function deleteReport(id: string): MT5Report[] {
  const reports = loadReports();
  const filtered = reports.filter(r => r.id !== id);
  saveReports(filtered);
  return filtered;
}

export function addReport(report: MT5Report): MT5Report[] {
  const reports = loadReports();
  reports.unshift(report);
  saveReports(reports);
  return reports;
}
