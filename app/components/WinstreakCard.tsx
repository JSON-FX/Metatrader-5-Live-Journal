'use client';

import { useMemo } from 'react';
import { MT5Deal } from '../lib/types';

interface WinstreakCardProps {
  deals: MT5Deal[];
}

export default function WinstreakCard({ deals }: WinstreakCardProps) {
  const streakData = useMemo(() => {
    // Get closing deals sorted by time
    const closingDeals = deals
      .filter(d => d.direction === 'out' && d.symbol)
      .sort((a, b) => {
        // Normalize date format (handle YYYY/MM/DD, YYYY.MM.DD, and YYYY-MM-DD)
        const timeA = a.time.replace(/[\/\.]/g, '-');
        const timeB = b.time.replace(/[\/\.]/g, '-');
        return new Date(timeA).getTime() - new Date(timeB).getTime();
      });

    if (closingDeals.length === 0) {
      return { currentDayStreak: 0, maxDayStreak: 0, currentTradeStreak: 0, maxTradeStreak: 0 };
    }

    // Calculate trade win streaks (include commission and swap in P/L)
    let currentTradeStreak = 0;
    let maxTradeStreak = 0;
    let tempTradeStreak = 0;

    for (const deal of closingDeals) {
      const totalPnL = deal.profit + (deal.commission || 0) + (deal.swap || 0);
      if (totalPnL > 0) {
        tempTradeStreak++;
        maxTradeStreak = Math.max(maxTradeStreak, tempTradeStreak);
      } else if (totalPnL < 0) {
        tempTradeStreak = 0;
      }
    }

    // Current streak (from the end)
    for (let i = closingDeals.length - 1; i >= 0; i--) {
      const totalPnL = closingDeals[i].profit + (closingDeals[i].commission || 0) + (closingDeals[i].swap || 0);
      if (totalPnL > 0) {
        currentTradeStreak++;
      } else if (totalPnL < 0) {
        break;
      }
    }

    // Calculate day win streaks (net positive days)
    // Include ALL deals (in and out) because commissions are charged on entry too
    const allDeals = deals.filter(d => d.symbol);
    const dailyPnL: Record<string, number> = {};
    allDeals.forEach(deal => {
      // Normalize date format (handle YYYY/MM/DD, YYYY.MM.DD, and YYYY-MM-DD)
      const rawDate = deal.time.split(' ')[0];
      const date = rawDate.replace(/[\/\.]/g, '-');
      const totalPnL = deal.profit + (deal.commission || 0) + (deal.swap || 0);
      dailyPnL[date] = (dailyPnL[date] || 0) + totalPnL;
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

    // Current day streak (from the end)
    for (let i = sortedDays.length - 1; i >= 0; i--) {
      if (dailyPnL[sortedDays[i]] > 0) {
        currentDayStreak++;
      } else if (dailyPnL[sortedDays[i]] < 0) {
        break;
      }
    }

    return { currentDayStreak, maxDayStreak, currentTradeStreak, maxTradeStreak };
  }, [deals]);

  const FireIcon = () => (
    <svg className="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 23c-3.866 0-7-3.134-7-7 0-2.577 1.06-4.877 3.063-6.683.232-.21.607-.137.73.142.18.41.444.876.784 1.357.134.19.37.265.58.176a6.002 6.002 0 01.988-.343c.204-.05.34-.243.34-.453V8.5c0-1.657 1.343-3 3-3s3 1.343 3 3v1.696c0 .21.136.403.34.453.35.085.68.199.988.343.21.089.446.014.58-.176.34-.481.604-.947.784-1.357.123-.28.498-.351.73-.142C18.94 11.123 20 13.423 20 16c0 3.866-3.134 7-7 7z"/>
    </svg>
  );

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="text-sm font-medium text-zinc-400 mb-3">Winstreak</div>

      <div className="flex items-center justify-around">
        {/* Days Streak */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-blue-400">{streakData.currentDayStreak}</span>
            <FireIcon />
          </div>
          <div className="bg-blue-500/20 text-blue-400 text-xs font-medium px-2 py-0.5 rounded">
            {streakData.maxDayStreak}
          </div>
          <span className="text-xs text-zinc-500 ml-1">Days</span>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-zinc-700" />

        {/* Trades Streak */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-blue-400">{streakData.currentTradeStreak}</span>
            <FireIcon />
          </div>
          <div className="bg-blue-500/20 text-blue-400 text-xs font-medium px-2 py-0.5 rounded">
            {streakData.maxTradeStreak}
          </div>
          <span className="text-xs text-zinc-500 ml-1">Trades</span>
        </div>
      </div>
    </div>
  );
}
