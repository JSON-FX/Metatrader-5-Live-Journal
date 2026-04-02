import { LiveTrade } from './live-types';
import { MT5Deal } from './types';

export interface TradeStats {
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  totalTrades: number;
  winRate: number;
  expectedPayoff: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  totalCommissionSwap: number;
  bestTrade: number;
  worstTrade: number;
}

export interface DailyPnl {
  date: string; // YYYY-MM-DD
  pnl: number;
  trades: number;
  wins: number;
}

export interface MonthlyPnl {
  year: number;
  month: number; // 0-11
  pnl: number;
  trades: number;
}

export interface StreakData {
  winStreak: number;
  maxWinStreak: number;
  loseStreak: number;
  maxLoseStreak: number;
  winStreakTrades: number;
  maxWinStreakTrades: number;
  loseStreakTrades: number;
  maxLoseStreakTrades: number;
}

export function calculateStats(trades: LiveTrade[], startingCapital: number): TradeStats {
  if (trades.length === 0) {
    return {
      netProfit: 0, grossProfit: 0, grossLoss: 0, profitFactor: 0,
      totalTrades: 0, winRate: 0, expectedPayoff: 0,
      maxDrawdown: 0, maxDrawdownPct: 0, totalCommissionSwap: 0,
      bestTrade: 0, worstTrade: 0,
    };
  }

  let grossProfit = 0;
  let grossLoss = 0;
  let totalCommissionSwap = 0;
  let bestTrade = -Infinity;
  let worstTrade = Infinity;

  for (const t of trades) {
    const net = t.profit + t.commission + t.swap;
    if (net > 0) grossProfit += net;
    else grossLoss += Math.abs(net);
    totalCommissionSwap += t.commission + t.swap;
    if (net > bestTrade) bestTrade = net;
    if (net < worstTrade) worstTrade = net;
  }

  const netProfit = grossProfit - grossLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const wins = trades.filter(t => (t.profit + t.commission + t.swap) > 0).length;
  const winRate = (wins / trades.length) * 100;
  const expectedPayoff = netProfit / trades.length;

  // Max drawdown from equity curve
  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
  let equity = startingCapital;
  let peak = equity;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;

  for (const t of sorted) {
    equity += t.profit + t.commission + t.swap;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      maxDrawdownPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  return {
    netProfit, grossProfit, grossLoss, profitFactor,
    totalTrades: trades.length, winRate, expectedPayoff,
    maxDrawdown, maxDrawdownPct, totalCommissionSwap,
    bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
    worstTrade: worstTrade === Infinity ? 0 : worstTrade,
  };
}

export function calculateRunningBalance(trades: LiveTrade[], startingCapital: number): { trade: LiveTrade; balance: number }[] {
  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
  let balance = startingCapital;
  return sorted.map(trade => {
    balance += trade.profit + trade.commission + trade.swap;
    return { trade, balance };
  });
}

export function calculateEquityCurve(trades: LiveTrade[], startingCapital: number): { time: string; value: number }[] {
  if (trades.length === 0) return [];

  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
  const points: { time: string; value: number }[] = [{ time: sorted[0].close_time, value: startingCapital }];

  let running = startingCapital;
  for (const t of sorted) {
    running += t.profit + t.commission + t.swap;
    points.push({ time: t.close_time, value: running });
  }

  return points;
}

export function groupByDay(trades: LiveTrade[]): DailyPnl[] {
  const map = new Map<string, DailyPnl>();

  for (const t of trades) {
    const date = t.close_time.slice(0, 10);
    const existing = map.get(date);
    const net = t.profit + t.commission + t.swap;
    if (existing) {
      existing.pnl += net;
      existing.trades += 1;
      if (net > 0) existing.wins += 1;
    } else {
      map.set(date, { date, pnl: net, trades: 1, wins: net > 0 ? 1 : 0 });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function groupByMonth(trades: LiveTrade[]): MonthlyPnl[] {
  const map = new Map<string, MonthlyPnl>();

  for (const t of trades) {
    const year = parseInt(t.close_time.slice(0, 4), 10);
    const month = parseInt(t.close_time.slice(5, 7), 10) - 1;
    const key = `${year}-${month}`;
    const existing = map.get(key);
    const net = t.profit + t.commission + t.swap;
    if (existing) {
      existing.pnl += net;
      existing.trades += 1;
    } else {
      map.set(key, { year, month, pnl: net, trades: 1 });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

export function calculateStreaks(trades: LiveTrade[]): StreakData {
  const daily = groupByDay(trades);
  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));

  // Day streaks (win + lose)
  let winDayStreak = 0, maxWinDayStreak = 0;
  let loseDayStreak = 0, maxLoseDayStreak = 0;
  for (const d of daily) {
    if (d.pnl > 0) {
      winDayStreak++; loseDayStreak = 0;
      if (winDayStreak > maxWinDayStreak) maxWinDayStreak = winDayStreak;
    } else if (d.pnl < 0) {
      loseDayStreak++; winDayStreak = 0;
      if (loseDayStreak > maxLoseDayStreak) maxLoseDayStreak = loseDayStreak;
    } else {
      winDayStreak = 0; loseDayStreak = 0;
    }
  }

  // Current day streaks (from end)
  let currentWinDays = 0, currentLoseDays = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].pnl > 0) { if (currentLoseDays > 0) break; currentWinDays++; }
    else if (daily[i].pnl < 0) { if (currentWinDays > 0) break; currentLoseDays++; }
    else break;
  }

  // Trade streaks (win + lose)
  let winTradeStreak = 0, maxWinTradeStreak = 0;
  let loseTradeStreak = 0, maxLoseTradeStreak = 0;
  for (const t of sorted) {
    const net = t.profit + t.commission + t.swap;
    if (net > 0) {
      winTradeStreak++; loseTradeStreak = 0;
      if (winTradeStreak > maxWinTradeStreak) maxWinTradeStreak = winTradeStreak;
    } else {
      loseTradeStreak++; winTradeStreak = 0;
      if (loseTradeStreak > maxLoseTradeStreak) maxLoseTradeStreak = loseTradeStreak;
    }
  }

  // Current trade streaks (from end)
  let currentWinTrades = 0, currentLoseTrades = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const net = sorted[i].profit + sorted[i].commission + sorted[i].swap;
    if (net > 0) { if (currentLoseTrades > 0) break; currentWinTrades++; }
    else { if (currentWinTrades > 0) break; currentLoseTrades++; }
  }

  return {
    winStreak: currentWinDays,
    maxWinStreak: maxWinDayStreak,
    loseStreak: currentLoseDays,
    maxLoseStreak: maxLoseDayStreak,
    winStreakTrades: currentWinTrades,
    maxWinStreakTrades: maxWinTradeStreak,
    loseStreakTrades: currentLoseTrades,
    maxLoseStreakTrades: maxLoseTradeStreak,
  };
}

export function calculateStreaksFromDeals(
  deals: MT5Deal[],
  dateRange?: { start: string; end: string }
): StreakData {
  // Filter to closing deals with a symbol
  let closingDeals = deals.filter(d => d.direction === 'out' && d.symbol);

  if (dateRange) {
    closingDeals = closingDeals.filter(d => {
      const date = d.time.split(' ')[0].replace(/[\/\.]/g, '-');
      return date >= dateRange.start && date <= dateRange.end;
    });
  }

  const sorted = [...closingDeals].sort((a, b) => {
    const ta = a.time.replace(/[\/\.]/g, '-');
    const tb = b.time.replace(/[\/\.]/g, '-');
    return ta.localeCompare(tb);
  });

  // Build daily PnL map
  const dailyPnl: Record<string, number> = {};
  for (const deal of sorted) {
    const date = deal.time.split(' ')[0].replace(/[\/\.]/g, '-');
    dailyPnl[date] = (dailyPnl[date] || 0) + deal.profit + (deal.commission || 0) + (deal.swap || 0);
  }
  const sortedDays = Object.keys(dailyPnl).sort();

  // Day streaks (win + lose)
  let winDayStreak = 0, maxWinDayStreak = 0;
  let loseDayStreak = 0, maxLoseDayStreak = 0;
  for (const day of sortedDays) {
    if (dailyPnl[day] > 0) {
      winDayStreak++; loseDayStreak = 0;
      if (winDayStreak > maxWinDayStreak) maxWinDayStreak = winDayStreak;
    } else if (dailyPnl[day] < 0) {
      loseDayStreak++; winDayStreak = 0;
      if (loseDayStreak > maxLoseDayStreak) maxLoseDayStreak = loseDayStreak;
    } else {
      winDayStreak = 0; loseDayStreak = 0;
    }
  }

  // Current day streaks (from end)
  let currentWinDays = 0, currentLoseDays = 0;
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    if (dailyPnl[sortedDays[i]] > 0) { if (currentLoseDays > 0) break; currentWinDays++; }
    else if (dailyPnl[sortedDays[i]] < 0) { if (currentWinDays > 0) break; currentLoseDays++; }
    else break;
  }

  // Trade streaks (win + lose)
  let winTradeStreak = 0, maxWinTradeStreak = 0;
  let loseTradeStreak = 0, maxLoseTradeStreak = 0;
  for (const deal of sorted) {
    const net = deal.profit + (deal.commission || 0) + (deal.swap || 0);
    if (net > 0) {
      winTradeStreak++; loseTradeStreak = 0;
      if (winTradeStreak > maxWinTradeStreak) maxWinTradeStreak = winTradeStreak;
    } else {
      loseTradeStreak++; winTradeStreak = 0;
      if (loseTradeStreak > maxLoseTradeStreak) maxLoseTradeStreak = loseTradeStreak;
    }
  }

  // Current trade streaks (from end)
  let currentWinTrades = 0, currentLoseTrades = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const net = sorted[i].profit + (sorted[i].commission || 0) + (sorted[i].swap || 0);
    if (net > 0) { if (currentLoseTrades > 0) break; currentWinTrades++; }
    else { if (currentWinTrades > 0) break; currentLoseTrades++; }
  }

  return {
    winStreak: currentWinDays,
    maxWinStreak: maxWinDayStreak,
    loseStreak: currentLoseDays,
    maxLoseStreak: maxLoseDayStreak,
    winStreakTrades: currentWinTrades,
    maxWinStreakTrades: maxWinTradeStreak,
    loseStreakTrades: currentLoseTrades,
    maxLoseStreakTrades: maxLoseTradeStreak,
  };
}

/**
 * Format a value based on display mode.
 */
export function formatValue(
  pnl: number,
  mode: 'money' | 'percent',
  opts?: { startingCapital?: number }
): string {
  if (mode === 'money') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(pnl);
  }

  const capital = opts?.startingCapital ?? 0;
  if (capital <= 0) return '0.00%';
  const pct = (pnl / capital) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}
