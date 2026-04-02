import { LiveTrade } from './live-types';

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

export interface WinStreaks {
  currentDays: number;
  maxDays: number;
  currentTrades: number;
  maxTrades: number;
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

export function calculateWinStreaks(trades: LiveTrade[]): WinStreaks {
  const daily = groupByDay(trades);

  // Current day streak (from end)
  let currentDays = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].pnl > 0) currentDays++;
    else break;
  }

  // Max day streak
  let streak = 0;
  let bestDayStreak = 0;
  for (const d of daily) {
    if (d.pnl > 0) { streak++; if (streak > bestDayStreak) bestDayStreak = streak; }
    else { streak = 0; }
  }

  // Trade streaks
  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));

  let tradeStreak = 0;
  let bestTradeStreak = 0;
  for (const t of sorted) {
    const net = t.profit + t.commission + t.swap;
    if (net > 0) { tradeStreak++; if (tradeStreak > bestTradeStreak) bestTradeStreak = tradeStreak; }
    else { tradeStreak = 0; }
  }

  // Current trade streak (from end)
  let currentTrades = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const net = sorted[i].profit + sorted[i].commission + sorted[i].swap;
    if (net > 0) currentTrades++;
    else break;
  }

  return {
    currentDays,
    maxDays: bestDayStreak,
    currentTrades,
    maxTrades: bestTradeStreak,
  };
}
