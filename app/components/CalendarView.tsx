'use client';

import React, { useMemo, useState } from 'react';
import { MT5Deal, MT5Settings } from '../lib/types';

interface CalendarViewProps {
  deals: MT5Deal[];
  settings: MT5Settings;
}

interface DayData {
  profit: number;
  percent: number;
  trades: number;
}

export default function CalendarView({ deals, settings }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    // Start with the most recent deal date or today
    const closingDeals = deals.filter(d => d.direction === 'out' && d.symbol);
    if (closingDeals.length > 0) {
      const lastDeal = closingDeals.sort((a, b) => {
        // Normalize date format (handle YYYY/MM/DD, YYYY.MM.DD, and YYYY-MM-DD)
        const timeA = a.time.replace(/[\/\.]/g, '-');
        const timeB = b.time.replace(/[\/\.]/g, '-');
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      })[0];
      // Normalize the time for Date parsing
      const normalizedTime = lastDeal.time.replace(/[\/\.]/g, '-');
      return new Date(normalizedTime);
    }
    return new Date();
  });

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000) {
      return `${value < 0 ? '-' : ''}$${(absValue / 1000).toFixed(1)}k`;
    }
    return `${value < 0 ? '-' : ''}$${absValue.toFixed(2)}`;
  };

  const { dailyData, monthStats, weeklyTotals } = useMemo(() => {
    // Get all deals with a symbol (both in and out) for P/L calculation
    const allDeals = deals.filter(d => d.symbol);
    const closingDeals = deals.filter(d => d.direction === 'out' && d.symbol);
    const initialDeposit = settings.initialDeposit || 1000;

    // Group by date - include ALL deals for P/L (both in and out)
    // because commissions are charged on entry (in) deals too
    const daily: Record<string, DayData> = {};

    // Sort all deals by time
    const sortedAllDeals = [...allDeals].sort((a, b) => {
      const timeA = a.time.replace(/[\/\.]/g, '-');
      const timeB = b.time.replace(/[\/\.]/g, '-');
      return new Date(timeA).getTime() - new Date(timeB).getTime();
    });

    sortedAllDeals.forEach(deal => {
      // Normalize date format (handle YYYY/MM/DD, YYYY.MM.DD, and YYYY-MM-DD)
      const rawDate = deal.time.split(' ')[0];
      const date = rawDate.replace(/[\/\.]/g, '-');
      if (!daily[date]) {
        daily[date] = { profit: 0, percent: 0, trades: 0 };
      }
      // Include profit, commission, and swap from ALL deals (in and out)
      daily[date].profit += deal.profit + (deal.commission || 0) + (deal.swap || 0);
      // Only count closing (out) deals as trades
      if (deal.direction === 'out') {
        daily[date].trades += 1;
      }
    });

    // Calculate percentages based on running balance at start of each day
    const sortedDates = Object.keys(daily).sort();
    let balanceAtDayStart = initialDeposit;
    sortedDates.forEach(date => {
      daily[date].percent = (daily[date].profit / balanceAtDayStart) * 100;
      balanceAtDayStart += daily[date].profit;
    });

    // Calculate month stats
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

    // Calculate weekly totals
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const totalCells = startPadding + totalDays;
    const numWeeks = Math.ceil(totalCells / 7);

    const weekly: { profit: number; percent: number }[] = [];
    for (let week = 0; week < numWeeks; week++) {
      let weekProfit = 0;
      for (let day = 0; day < 7; day++) {
        const cellIndex = week * 7 + day;
        const dayNum = cellIndex - startPadding + 1;
        if (dayNum >= 1 && dayNum <= totalDays) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          if (daily[dateStr]) {
            weekProfit += daily[dateStr].profit;
          }
        }
      }
      const weekPercent = initialDeposit > 0 ? (weekProfit / initialDeposit) * 100 : 0;
      weekly.push({ profit: weekProfit, percent: weekPercent });
    }

    return {
      dailyData: daily,
      monthStats: { trades: monthTrades, wins: monthWins, profit: monthProfit, percent: monthPercent },
      weeklyTotals: weekly
    };
  }, [deals, settings, currentDate]);

  const navigateMonth = (delta: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const cells: React.ReactElement[] = [];

    // Header row
    const headerRow = (
      <div key="header" className="grid grid-cols-8 gap-1 mb-1">
        {days.map(day => (
          <div key={day} className="text-center text-xs text-zinc-500 py-2">
            {day}
          </div>
        ))}
        <div className="text-center text-xs text-zinc-500 py-2">Total</div>
      </div>
    );

    // Calendar cells by week
    const totalCells = startPadding + totalDays;
    const numWeeks = Math.ceil(totalCells / 7);

    for (let week = 0; week < numWeeks; week++) {
      const weekCells: React.ReactElement[] = [];

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const cellIndex = week * 7 + dayOfWeek;
        const dayNum = cellIndex - startPadding + 1;

        if (dayNum < 1 || dayNum > totalDays) {
          // Previous/next month days
          let displayNum: number;
          if (dayNum < 1) {
            const prevMonthLast = new Date(year, month, 0).getDate();
            displayNum = prevMonthLast + dayNum;
          } else {
            displayNum = dayNum - totalDays;
          }
          weekCells.push(
            <div key={`empty-${cellIndex}`} className="bg-zinc-900/50 rounded-lg p-2 min-h-[70px]">
              <span className="text-xs text-zinc-700">{displayNum}</span>
            </div>
          );
        } else {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const dayData = dailyData[dateStr];
          const isToday = new Date().toISOString().split('T')[0] === dateStr;

          weekCells.push(
            <div
              key={dateStr}
              className={`rounded-lg p-2 min-h-[70px] ${
                isToday ? 'bg-zinc-700 border border-zinc-600' : 'bg-zinc-800/50'
              } ${dayData && dayData.profit < 0 ? 'border-l-2 border-l-red-500/50' : ''}`}
            >
              <span className="text-xs text-zinc-400">{dayNum}</span>
              {dayData && (
                <div className="mt-1">
                  <div className={`text-sm font-medium ${dayData.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {dayData.profit >= 0 ? '+' : ''}{formatCurrency(dayData.profit)}
                  </div>
                  <div className={`text-xs ${dayData.profit >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
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
      weekCells.push(
        <div
          key={`week-${week}`}
          className={`rounded-lg p-2 min-h-[70px] flex flex-col justify-center items-center ${
            weekTotal && weekTotal.profit !== 0
              ? weekTotal.profit > 0 ? 'border border-emerald-500/30' : 'border border-red-500/30'
              : ''
          }`}
        >
          {weekTotal && weekTotal.profit !== 0 ? (
            <>
              <div className={`text-sm font-medium ${weekTotal.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {weekTotal.profit >= 0 ? '+' : ''}{formatCurrency(weekTotal.profit)}
              </div>
              <div className={`text-xs ${weekTotal.profit >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                {weekTotal.percent >= 0 ? '+' : ''}{weekTotal.percent.toFixed(2)}%
              </div>
            </>
          ) : (
            <span className="text-zinc-600">-</span>
          )}
        </div>
      );

      cells.push(
        <div key={`week-${week}`} className="grid grid-cols-8 gap-1 mb-1">
          {weekCells}
        </div>
      );
    }

    return (
      <>
        {headerRow}
        {cells}
      </>
    );
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateMonth(-1)}
            className="text-zinc-400 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-white font-medium">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="text-zinc-400 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Month Stats Summary */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-zinc-500">Trades</span>
            <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">{monthStats.trades}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-zinc-500">Wins</span>
            <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">{monthStats.wins}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-zinc-500">Profits</span>
            <span className={`px-2 py-0.5 rounded ${monthStats.profit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {formatCurrency(monthStats.profit)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-zinc-500">Percent</span>
            <span className={`px-2 py-0.5 rounded ${monthStats.percent >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {monthStats.percent >= 0 ? '+' : ''}{monthStats.percent.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {renderCalendar()}
    </div>
  );
}
