'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { MT5Report } from '../../lib/types';

interface ReportCalendarProps {
  report: MT5Report;
}

interface DayData {
  profit: number;
  percent: number;
  trades: number;
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 1000) {
    return `${value < 0 ? '-' : ''}$${(absValue / 1000).toFixed(1)}k`;
  }
  return `${value < 0 ? '-' : ''}$${absValue.toFixed(2)}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ReportCalendar({ report }: ReportCalendarProps) {
  const { deals, settings } = report;

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

  const { dailyData, weeklyTotals, monthStats } = useMemo(() => {
    const allDeals = deals.filter(d => d.symbol);
    const initialDeposit = settings.initialDeposit || 1000;

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

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
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
  }, [deals, settings, currentDate]);

  // Win streak calculation
  const streakData = useMemo(() => {
    const closingDeals = deals
      .filter(d => d.direction === 'out' && d.symbol)
      .sort((a, b) => {
        const ta = a.time.replace(/[\/\.]/g, '-');
        const tb = b.time.replace(/[\/\.]/g, '-');
        return new Date(ta).getTime() - new Date(tb).getTime();
      });

    if (closingDeals.length === 0) {
      return { currentDayStreak: 0, maxDayStreak: 0, currentTradeStreak: 0, maxTradeStreak: 0 };
    }

    // Trade streaks
    let currentTradeStreak = 0;
    let maxTradeStreak = 0;
    let tempTradeStreak = 0;

    for (const deal of closingDeals) {
      const pnl = deal.profit + (deal.commission || 0) + (deal.swap || 0);
      if (pnl > 0) {
        tempTradeStreak++;
        maxTradeStreak = Math.max(maxTradeStreak, tempTradeStreak);
      } else if (pnl < 0) {
        tempTradeStreak = 0;
      }
    }

    for (let i = closingDeals.length - 1; i >= 0; i--) {
      const pnl = closingDeals[i].profit + (closingDeals[i].commission || 0) + (closingDeals[i].swap || 0);
      if (pnl > 0) currentTradeStreak++;
      else if (pnl < 0) break;
    }

    // Day streaks
    const allDeals = deals.filter(d => d.symbol);
    const dailyPnL: Record<string, number> = {};
    allDeals.forEach(deal => {
      const rawDate = deal.time.split(' ')[0];
      const date = rawDate.replace(/[\/\.]/g, '-');
      dailyPnL[date] = (dailyPnL[date] || 0) + deal.profit + (deal.commission || 0) + (deal.swap || 0);
    });

    const sortedDays = Object.keys(dailyPnL).sort();
    let currentDayStreak = 0;
    let maxDayStreak = 0;
    let tempDayStreak = 0;

    for (const day of sortedDays) {
      if (dailyPnL[day] > 0) {
        tempDayStreak++;
        maxDayStreak = Math.max(maxDayStreak, tempDayStreak);
      } else if (dailyPnL[day] < 0) {
        tempDayStreak = 0;
      }
    }

    for (let i = sortedDays.length - 1; i >= 0; i--) {
      if (dailyPnL[sortedDays[i]] > 0) currentDayStreak++;
      else if (dailyPnL[sortedDays[i]] < 0) break;
    }

    return { currentDayStreak, maxDayStreak, currentTradeStreak, maxTradeStreak };
  }, [deals]);

  const navigateMonth = (delta: number) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const numWeeks = Math.ceil((startPadding + totalDays) / 7);

    const rows: React.ReactElement[] = [];

    for (let week = 0; week < numWeeks; week++) {
      const cells: React.ReactElement[] = [];

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const cellIndex = week * 7 + dayOfWeek;
        const dayNum = cellIndex - startPadding + 1;

        if (dayNum < 1 || dayNum > totalDays) {
          let displayNum: number;
          if (dayNum < 1) {
            displayNum = new Date(year, month, 0).getDate() + dayNum;
          } else {
            displayNum = dayNum - totalDays;
          }
          cells.push(
            <div key={`empty-${cellIndex}`} className="bg-bg-tertiary/30 rounded-lg p-2 min-h-[70px]">
              <span className="text-xs text-text-muted opacity-30">{displayNum}</span>
            </div>
          );
        } else {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const dayData = dailyData[dateStr];

          cells.push(
            <div
              key={dateStr}
              className={`rounded-lg p-2 min-h-[70px] bg-bg-tertiary/40 ${
                dayData && dayData.profit < 0 ? 'border-l-2 border-l-loss/50' : ''
              } ${dayData && dayData.profit > 0 ? 'border-l-2 border-l-profit/50' : ''}`}
            >
              <span className="text-xs text-text-muted">{dayNum}</span>
              {dayData && dayData.trades > 0 && (
                <div className="mt-1">
                  <div className={`text-xs font-mono font-medium ${dayData.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {dayData.profit >= 0 ? '+' : ''}{formatCurrency(dayData.profit)}
                  </div>
                  <div className={`text-[10px] font-mono ${dayData.profit >= 0 ? 'text-profit/70' : 'text-loss/70'}`}>
                    {dayData.percent >= 0 ? '+' : ''}{dayData.percent.toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
          );
        }
      }

      // Weekly total column
      const weekTotal = weeklyTotals[week];
      cells.push(
        <div
          key={`week-${week}`}
          className={`rounded-lg p-2 min-h-[70px] flex flex-col justify-center items-center border ${
            weekTotal && weekTotal.profit !== 0
              ? weekTotal.profit > 0
                ? 'border-profit/20 bg-profit/5'
                : 'border-loss/20 bg-loss/5'
              : 'border-transparent'
          }`}
        >
          {weekTotal && weekTotal.profit !== 0 ? (
            <>
              <div className={`text-xs font-mono font-medium ${weekTotal.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {weekTotal.profit >= 0 ? '+' : ''}{formatCurrency(weekTotal.profit)}
              </div>
              <div className={`text-[10px] font-mono ${weekTotal.profit >= 0 ? 'text-profit/70' : 'text-loss/70'}`}>
                {weekTotal.percent >= 0 ? '+' : ''}{weekTotal.percent.toFixed(2)}%
              </div>
            </>
          ) : (
            <span className="text-text-muted opacity-30 text-xs">—</span>
          )}
        </div>
      );

      rows.push(
        <div key={`row-${week}`} className="grid grid-cols-8 gap-1 mb-1">
          {cells}
        </div>
      );
    }

    return rows;
  };

  return (
    <div className="space-y-4">
      {/* Calendar card */}
      <div className="bg-bg-secondary border border-border rounded-lg p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-text-primary min-w-[140px] text-center">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Month stats */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-text-muted uppercase tracking-[1px]">Trades</span>
              <span className="bg-bg-tertiary px-2 py-0.5 rounded font-mono text-text-secondary">{monthStats.trades}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-muted uppercase tracking-[1px]">Wins</span>
              <span className="bg-bg-tertiary px-2 py-0.5 rounded font-mono text-text-secondary">{monthStats.wins}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-muted uppercase tracking-[1px]">P/L</span>
              <span className={`px-2 py-0.5 rounded font-mono ${
                monthStats.profit >= 0 ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
              }`}>
                {monthStats.profit >= 0 ? '+' : ''}{formatCurrency(monthStats.profit)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-muted uppercase tracking-[1px]">Pct</span>
              <span className={`px-2 py-0.5 rounded font-mono ${
                monthStats.percent >= 0 ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
              }`}>
                {monthStats.percent >= 0 ? '+' : ''}{monthStats.percent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Day header row */}
        <div className="grid grid-cols-8 gap-1 mb-1">
          {DAY_NAMES.map(day => (
            <div key={day} className="text-center text-[10px] text-text-muted uppercase tracking-[1px] py-2">
              {day}
            </div>
          ))}
          <div className="text-center text-[10px] text-text-muted uppercase tracking-[1px] py-2">Total</div>
        </div>

        {/* Calendar grid */}
        {renderCalendar()}
      </div>

      {/* Win streaks card */}
      <div className="bg-bg-secondary border border-border rounded-lg p-4">
        <p className="text-[11px] text-text-muted uppercase tracking-[1px] mb-4">Win Streaks</p>
        <div className="flex items-center justify-around">
          {/* Day streak */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] text-text-muted uppercase tracking-[1px]">Days</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold font-mono text-accent">{streakData.currentDayStreak}</span>
              <Flame className="w-5 h-5 text-warning" />
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-text-muted">Max:</span>
              <span className="bg-accent/10 text-accent px-2 py-0.5 rounded font-mono">{streakData.maxDayStreak}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-16 w-px bg-border" />

          {/* Trade streak */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] text-text-muted uppercase tracking-[1px]">Trades</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold font-mono text-accent">{streakData.currentTradeStreak}</span>
              <Flame className="w-5 h-5 text-warning" />
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-text-muted">Max:</span>
              <span className="bg-accent/10 text-accent px-2 py-0.5 rounded font-mono">{streakData.maxTradeStreak}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
