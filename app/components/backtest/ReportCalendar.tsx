'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MT5Report } from '../../lib/types';
import { DisplayMode } from '../../lib/live-types';
import { calculateStreaksFromDeals, formatValue } from '../../lib/trade-stats';
import StreaksTable from '../shared/StreaksTable';

interface ReportCalendarProps {
  report: MT5Report;
  displayMode: DisplayMode;
}

interface DayData {
  profit: number;
  percent: number;
  trades: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ReportCalendar({ report, displayMode }: ReportCalendarProps) {
  const { deals, settings } = report;
  const initialDeposit = settings.initialDeposit || 1000;

  const [currentDate, setCurrentDate] = useState(() => {
    const closingDeals = deals.filter(d => d.direction === 'out' && d.symbol);
    if (closingDeals.length > 0) {
      const lastDeal = [...closingDeals].sort((a, b) => {
        const ta = a.time.replace(/[\/\.]/g, '-');
        const tb = b.time.replace(/[\/\.]/g, '-');
        return new Date(tb).getTime() - new Date(ta).getTime();
      })[0];
      const normalized = lastDeal.time.replace(/[\/\.]/g, '-');
      return new Date(normalized);
    }
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { dailyData, weeklyTotals, monthStats } = useMemo(() => {
    const allDeals = deals.filter(d => d.symbol);
    const daily: Record<string, DayData> = {};

    const sortedDeals = [...allDeals].sort((a, b) => {
      const ta = a.time.replace(/[\/\.]/g, '-');
      const tb = b.time.replace(/[\/\.]/g, '-');
      return new Date(ta).getTime() - new Date(tb).getTime();
    });

    sortedDeals.forEach(deal => {
      const rawDate = deal.time.split(' ')[0];
      const date = rawDate.replace(/[\/\.]/g, '-');
      if (!daily[date]) daily[date] = { profit: 0, percent: 0, trades: 0 };
      daily[date].profit += deal.profit + (deal.commission || 0) + (deal.swap || 0);
      if (deal.direction === 'out') daily[date].trades += 1;
    });

    const sortedDates = Object.keys(daily).sort();
    let balance = initialDeposit;
    sortedDates.forEach(date => {
      daily[date].percent = (daily[date].profit / balance) * 100;
      balance += daily[date].profit;
    });

    let monthTrades = 0;
    let monthWins = 0;
    let monthProfit = 0;

    Object.keys(daily).forEach(date => {
      const d = new Date(date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        monthTrades += daily[date].trades;
        monthProfit += daily[date].profit;
        if (daily[date].profit > 0) monthWins += daily[date].trades;
      }
    });

    const monthPercent = initialDeposit > 0 ? (monthProfit / initialDeposit) * 100 : 0;

    // Weekly totals
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const numWeeks = Math.ceil((startPadding + totalDays) / 7);

    const weekly: { profit: number; percent: number }[] = [];
    for (let week = 0; week < numWeeks; week++) {
      let weekProfit = 0;
      for (let day = 0; day < 7; day++) {
        const cellIndex = week * 7 + day;
        const dayNum = cellIndex - startPadding + 1;
        if (dayNum >= 1 && dayNum <= totalDays) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          if (daily[dateStr]) weekProfit += daily[dateStr].profit;
        }
      }
      const weekPercent = initialDeposit > 0 ? (weekProfit / initialDeposit) * 100 : 0;
      weekly.push({ profit: weekProfit, percent: weekPercent });
    }

    return {
      dailyData: daily,
      weeklyTotals: weekly,
      monthStats: { trades: monthTrades, wins: monthWins, profit: monthProfit, percent: monthPercent },
    };
  }, [deals, year, month, initialDeposit]);

  // Streaks: month-scoped (to selected calendar month) and all-time
  const monthDateRange = useMemo(() => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [year, month]);

  const monthStreaks = useMemo(() => calculateStreaksFromDeals(deals, monthDateRange), [deals, monthDateRange]);
  const allTimeStreaks = useMemo(() => calculateStreaksFromDeals(deals), [deals]);

  const navigateMonth = (delta: number) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  };

  // Build calendar weeks
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDayOfWeek).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigateMonth(-1)} className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-semibold text-text-primary min-w-[160px] text-center">
              {MONTH_NAMES[month]} {year}
            </h3>
            <button onClick={() => navigateMonth(1)} className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-text-muted">Trades <span className="text-text-primary font-semibold">{monthStats.trades}</span></span>
            <span className="text-text-muted">Wins <span className="text-text-primary font-semibold">{monthStats.wins}</span></span>
            <span className="text-text-muted">P/L <span className={monthStats.profit >= 0 ? 'text-profit font-semibold' : 'text-loss font-semibold'}>{formatValue(monthStats.profit, displayMode, { startingCapital: initialDeposit })}</span></span>
            <span className="text-text-muted">PCT <span className={monthStats.percent >= 0 ? 'text-profit font-semibold' : 'text-loss font-semibold'}>{monthStats.percent >= 0 ? '+' : ''}{monthStats.percent.toFixed(2)}%</span></span>
          </div>
        </div>

        {/* Calendar grid */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {DAY_NAMES.map(d => (
                <th key={d} className="text-[10px] text-text-muted uppercase tracking-wider font-medium py-2 text-center">{d}</th>
              ))}
              <th className="text-[10px] text-text-muted uppercase tracking-wider font-medium py-2 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, wi) => (
              <tr key={wi}>
                {w.map((day, di) => {
                  if (day === null) return <td key={di} className="border border-border/50 p-2 h-16" />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const data = dailyData[dateStr];
                  const pct = data && initialDeposit > 0 ? (data.profit / initialDeposit) * 100 : 0;
                  return (
                    <td
                      key={di}
                      className={`border border-border/50 p-2 h-16 align-top text-right ${
                        data ? (data.profit > 0 ? 'bg-profit/5' : data.profit < 0 ? 'bg-loss/5' : '') : ''
                      }`}
                    >
                      <div className="text-[10px] text-text-muted mb-1">{day}</div>
                      {data && data.trades > 0 && (
                        <>
                          <div className={`text-xs font-semibold font-mono ${data.profit > 0 ? 'text-profit' : 'text-loss'}`}>
                            {formatValue(data.profit, displayMode, { startingCapital: initialDeposit })}
                          </div>
                          {displayMode !== 'percent' && (
                            <div className={`text-[10px] font-mono ${pct > 0 ? 'text-profit' : 'text-loss'}`}>
                              {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
                <td className={`border border-border/50 p-2 h-16 align-middle text-right ${
                  weeklyTotals[wi].profit > 0 ? 'bg-profit/5' : weeklyTotals[wi].profit < 0 ? 'bg-loss/5' : ''
                }`}>
                  {weeklyTotals[wi].profit !== 0 && (
                    <>
                      <div className={`text-xs font-semibold font-mono ${weeklyTotals[wi].profit > 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatValue(weeklyTotals[wi].profit, displayMode, { startingCapital: initialDeposit })}
                      </div>
                      {displayMode !== 'percent' && (
                        <div className={`text-[10px] font-mono ${weeklyTotals[wi].percent > 0 ? 'text-profit' : 'text-loss'}`}>
                          {weeklyTotals[wi].percent > 0 ? '+' : ''}{weeklyTotals[wi].percent.toFixed(2)}%
                        </div>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Streaks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StreaksTable title={`${MONTH_NAMES[month]} Streaks`} streaks={monthStreaks} />
        <StreaksTable title="All-Time Streaks" streaks={allTimeStreaks} />
      </div>
    </div>
  );
}
