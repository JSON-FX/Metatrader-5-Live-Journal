'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import StreaksTable from '../shared/StreaksTable';
import { LiveTrade, DisplayMode } from '../../lib/live-types';
import { groupByDay, calculateStreaks, DailyPnl, formatValue } from '../../lib/trade-stats';
import { useSettings } from '../../lib/settings-context';

interface CalendarTabProps {
  trades: LiveTrade[];
  balance: number;
  displayMode: DisplayMode;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarTab({ trades, balance, displayMode }: CalendarTabProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const { timezone } = useSettings();

  const dailyData = useMemo(() => groupByDay(trades, timezone), [trades, timezone]);
  // Filter trades for selected month and calculate streaks
  const monthTrades = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return trades.filter(t => t.close_time.startsWith(prefix));
  }, [trades, year, month]);

  const monthStreaks = useMemo(() => calculateStreaks(monthTrades, timezone), [monthTrades, timezone]);
  const allTimeStreaks = useMemo(() => calculateStreaks(trades, timezone), [trades, timezone]);

  const startingCapital = useMemo(() => {
    const totalPnl = trades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    return balance - totalPnl;
  }, [trades, balance]);

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const dayMap = useMemo(() => {
    const map = new Map<number, DailyPnl>();
    for (const d of dailyData) {
      if (d.date.startsWith(monthKey)) {
        const day = parseInt(d.date.slice(8, 10), 10);
        map.set(day, d);
      }
    }
    return map;
  }, [dailyData, monthKey]);

  const monthSummary = useMemo(() => {
    let pnl = 0, tradeCt = 0, wins = 0;
    dayMap.forEach(d => { pnl += d.pnl; tradeCt += d.trades; wins += d.wins; });
    const pct = startingCapital > 0 ? (pnl / startingCapital) * 100 : 0;
    return { trades: tradeCt, wins, pnl, pct };
  }, [dayMap, startingCapital]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const weeklyTotals = weeks.map(w => {
    let pnl = 0;
    w.forEach(d => { if (d) { const dd = dayMap.get(d); if (dd) pnl += dd.pnl; } });
    const pct = startingCapital > 0 ? (pnl / startingCapital) * 100 : 0;
    return { pnl, pct };
  });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  if (trades.length === 0) {
    return <div className="py-16 text-center text-text-muted text-sm">No trades yet</div>;
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-semibold text-text-primary min-w-[160px] text-center">
              {MONTH_NAMES[month]} {year}
            </h3>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-text-muted">Trades <span className="text-text-primary font-semibold">{monthSummary.trades}</span></span>
            <span className="text-text-muted">Wins <span className="text-text-primary font-semibold">{monthSummary.wins}</span></span>
            <span className="text-text-muted">P/L <span className={monthSummary.pnl >= 0 ? 'text-profit font-semibold' : 'text-loss font-semibold'}>{formatValue(monthSummary.pnl, displayMode, { startingCapital })}</span></span>
            <span className="text-text-muted">PCT <span className={monthSummary.pct >= 0 ? 'text-profit font-semibold' : 'text-loss font-semibold'}>{monthSummary.pct >= 0 ? '+' : ''}{monthSummary.pct.toFixed(2)}%</span></span>
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
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((day, di) => {
                  if (day === null) return <td key={di} className="border border-border/50 p-2 h-16" />;
                  const data = dayMap.get(day);
                  const pct = data && startingCapital > 0 ? (data.pnl / startingCapital) * 100 : 0;
                  return (
                    <td
                      key={di}
                      className={`border border-border/50 p-2 h-16 align-top text-right ${
                        data ? (data.pnl > 0 ? 'bg-profit/5' : data.pnl < 0 ? 'bg-loss/5' : '') : ''
                      }`}
                    >
                      <div className="text-[10px] text-text-muted mb-1">{day}</div>
                      {data && (
                        <>
                          <div className={`text-xs font-semibold font-mono ${data.pnl > 0 ? 'text-profit' : 'text-loss'}`}>
                            {formatValue(data.pnl, displayMode, { startingCapital })}
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
                  weeklyTotals[wi].pnl > 0 ? 'bg-profit/5' : weeklyTotals[wi].pnl < 0 ? 'bg-loss/5' : ''
                }`}>
                  {weeklyTotals[wi].pnl !== 0 && (
                    <>
                      <div className={`text-xs font-semibold font-mono ${weeklyTotals[wi].pnl > 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatValue(weeklyTotals[wi].pnl, displayMode, { startingCapital })}
                      </div>
                      {displayMode !== 'percent' && (
                        <div className={`text-[10px] font-mono ${weeklyTotals[wi].pct > 0 ? 'text-profit' : 'text-loss'}`}>
                          {weeklyTotals[wi].pct > 0 ? '+' : ''}{weeklyTotals[wi].pct.toFixed(2)}%
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StreaksTable title={`${MONTH_NAMES[month]} Streaks`} streaks={monthStreaks} />
        <StreaksTable title="All-Time Streaks" streaks={allTimeStreaks} />
      </div>
    </div>
  );
}
