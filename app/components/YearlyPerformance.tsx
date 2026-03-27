'use client';

import { useMemo, useState } from 'react';
import { MT5Deal, MT5Settings } from '../lib/types';

interface YearlyPerformanceProps {
  deals: MT5Deal[];
  settings: MT5Settings;
}

interface MonthData {
  profit: number;
  percent: number;
  trades: number;
}

export default function YearlyPerformance({ deals, settings }: YearlyPerformanceProps) {
  const [displayMode, setDisplayMode] = useState<'currency' | 'percent'>('currency');

  const { yearlyData, years } = useMemo(() => {
    // Get all deals with a symbol (both in and out) for P/L calculation
    const allDeals = deals.filter(d => d.symbol);
    const initialDeposit = settings.initialDeposit || 1000;

    // Group by year and month - include ALL deals for P/L (both in and out)
    // because commissions are charged on entry (in) deals too
    const data: Record<number, Record<number, MonthData>> = {};

    allDeals.forEach(deal => {
      // Normalize date format (handle YYYY/MM/DD, YYYY.MM.DD, and YYYY-MM-DD)
      const normalizedTime = deal.time.replace(/[\/\.]/g, '-');
      const date = new Date(normalizedTime);
      const year = date.getFullYear();
      const month = date.getMonth();

      if (!data[year]) {
        data[year] = {};
      }
      if (!data[year][month]) {
        data[year][month] = { profit: 0, percent: 0, trades: 0 };
      }

      // Include profit, commission, and swap from ALL deals (in and out)
      data[year][month].profit += deal.profit + (deal.commission || 0) + (deal.swap || 0);
      // Only count closing (out) deals as trades
      if (deal.direction === 'out') {
        data[year][month].trades += 1;
      }
    });

    // Calculate percentages
    Object.keys(data).forEach(yearStr => {
      const year = parseInt(yearStr);
      Object.keys(data[year]).forEach(monthStr => {
        const month = parseInt(monthStr);
        data[year][month].percent = (data[year][month].profit / initialDeposit) * 100;
      });
    });

    const sortedYears = Object.keys(data).map(Number).sort((a, b) => b - a);

    return { yearlyData: data, years: sortedYears };
  }, [deals, settings]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const formatValue = (data: MonthData | undefined) => {
    if (!data || data.trades === 0) return null;

    if (displayMode === 'currency') {
      const value = data.profit;
      const absValue = Math.abs(value);
      if (absValue >= 1000) {
        return `${value >= 0 ? '+' : '-'}${(absValue / 1000).toFixed(0)}`;
      }
      return `${value >= 0 ? '+' : ''}${Math.round(value)}`;
    } else {
      return `${data.percent >= 0 ? '+' : ''}${data.percent.toFixed(1)}%`;
    }
  };

  const getYearTotal = (year: number) => {
    if (!yearlyData[year]) return null;

    let totalProfit = 0;
    let totalTrades = 0;

    Object.values(yearlyData[year]).forEach(monthData => {
      totalProfit += monthData.profit;
      totalTrades += monthData.trades;
    });

    if (totalTrades === 0) return null;

    const percent = (totalProfit / (settings.initialDeposit || 1000)) * 100;

    return {
      profit: totalProfit,
      percent,
      trades: totalTrades
    };
  };

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Yearly Performance</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDisplayMode('currency')}
            className={`p-2 rounded ${
              displayMode === 'currency'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="text-sm font-medium">$</span>
          </button>
          <button
            onClick={() => setDisplayMode('percent')}
            className={`p-2 rounded ${
              displayMode === 'percent'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="text-sm font-medium">%</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-xs text-zinc-500 font-normal py-2 px-1 w-12"></th>
              {months.map(month => (
                <th key={month} className="text-center text-xs text-zinc-500 font-normal py-2 px-1">
                  {month}
                </th>
              ))}
              <th className="text-center text-xs text-zinc-500 font-normal py-2 px-1">YTD</th>
            </tr>
          </thead>
          <tbody>
            {years.map(year => {
              const yearTotal = getYearTotal(year);
              return (
                <tr key={year}>
                  <td className="text-left text-sm text-zinc-400 py-2 px-1">{year}</td>
                  {months.map((_, monthIndex) => {
                    const monthData = yearlyData[year]?.[monthIndex];
                    const value = formatValue(monthData);

                    return (
                      <td key={monthIndex} className="text-center py-2 px-1">
                        <div
                          className={`rounded-lg p-2 min-h-[50px] flex flex-col justify-center items-center ${
                            monthData && monthData.trades > 0
                              ? monthData.profit >= 0
                                ? 'border border-blue-500/30'
                                : 'border border-red-500/30'
                              : 'bg-zinc-800/30'
                          }`}
                        >
                          {value ? (
                            <>
                              <div className={`text-sm font-medium ${
                                monthData!.profit >= 0 ? 'text-blue-400' : 'text-red-400'
                              }`}>
                                {value}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {monthData!.trades} {monthData!.trades === 1 ? 'trade' : 'trades'}
                              </div>
                            </>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center py-2 px-1">
                    <div
                      className={`rounded-lg p-2 min-h-[50px] flex flex-col justify-center items-center ${
                        yearTotal
                          ? yearTotal.profit >= 0
                            ? 'border border-blue-500/50'
                            : 'border border-red-500/50'
                          : 'bg-zinc-800/30'
                      }`}
                    >
                      {yearTotal ? (
                        <>
                          <div className={`text-sm font-medium ${
                            yearTotal.profit >= 0 ? 'text-blue-400' : 'text-red-400'
                          }`}>
                            {displayMode === 'currency'
                              ? `${yearTotal.profit >= 0 ? '+' : ''}${Math.round(yearTotal.profit)}`
                              : `${yearTotal.percent >= 0 ? '+' : ''}${yearTotal.percent.toFixed(1)}%`
                            }
                          </div>
                          <div className="text-xs text-zinc-500">
                            {yearTotal.trades} {yearTotal.trades === 1 ? 'trade' : 'trades'}
                          </div>
                        </>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
