'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { LiveTrade } from '../lib/live-types';

interface LiveEquityChartProps {
  trades: LiveTrade[];
  balance: number;
}

interface ChartPoint {
  date: string;
  label: string;
  balance: number;
  profit: number;
  tradeNum: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

interface TooltipPayload {
  date: string;
  label: string;
  balance: number;
  profit: number;
  tradeNum: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TooltipPayload }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-zinc-400 mb-2">{data.label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm text-zinc-300">Balance:</span>
          <span className="text-sm font-semibold text-white">{formatCurrency(data.balance)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${data.profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-sm text-zinc-300">Trade P/L:</span>
          <span className={`text-sm font-semibold ${data.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(data.profit)}
          </span>
        </div>
        <p className="text-xs text-zinc-500 mt-1">Trade #{data.tradeNum}</p>
      </div>
    </div>
  );
}

export default function LiveEquityChart({ trades, balance }: LiveEquityChartProps) {
  const chartData = useMemo(() => {
    if (trades.length === 0) return [];

    // Sort trades by close_time ascending to build equity curve
    const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));

    // Work backwards from current balance to find the starting balance
    const totalPnl = sorted.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    const startingBalance = balance - totalPnl;

    const points: ChartPoint[] = [];

    // Initial point
    points.push({
      date: sorted[0].close_time,
      label: format(parseISO(sorted[0].close_time), 'MMM d, yyyy'),
      balance: startingBalance,
      profit: 0,
      tradeNum: 0,
    });

    // Build running balance from each closed trade
    let running = startingBalance;
    sorted.forEach((trade, i) => {
      const netPl = trade.profit + trade.commission + trade.swap;
      running += netPl;
      points.push({
        date: trade.close_time,
        label: format(parseISO(trade.close_time), 'MMM d, yyyy HH:mm'),
        balance: running,
        profit: netPl,
        tradeNum: i + 1,
      });
    });

    return points;
  }, [trades, balance]);

  const { minValue, maxValue, startingBalance } = useMemo(() => {
    if (chartData.length === 0) return { minValue: 0, maxValue: 0, startingBalance: balance };
    const balances = chartData.map(d => d.balance);
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const padding = Math.max((max - min) * 0.1, 10);
    return {
      minValue: Math.floor((min - padding) / 10) * 10,
      maxValue: Math.ceil((max + padding) / 10) * 10,
      startingBalance: chartData[0].balance,
    };
  }, [chartData, balance]);

  const totalChange = balance - startingBalance;
  const totalChangePct = startingBalance > 0 ? (totalChange / startingBalance) * 100 : 0;
  const isProfit = totalChange >= 0;

  if (chartData.length < 2) {
    return null;
  }

  return (
    <div className="w-full bg-zinc-900 rounded-xl border border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Live Equity Curve</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Balance progression from {trades.length} closed trades
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
            {isProfit ? '+' : ''}{totalChangePct.toFixed(2)}%
          </p>
          <p className={`text-sm ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}{formatCurrency(totalChange)}
          </p>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="liveBalanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => {
                try {
                  return format(parseISO(v), 'MMM d');
                } catch {
                  return v;
                }
              }}
              stroke="#71717a"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              domain={[minValue, maxValue]}
              tickFormatter={(v) =>
                v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
              }
              stroke="#71717a"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={65}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={startingBalance}
              stroke="#71717a"
              strokeDasharray="5 5"
              strokeOpacity={0.5}
            />
            <ReferenceLine
              y={balance}
              stroke="#3b82f6"
              strokeDasharray="4 4"
              strokeOpacity={0.8}
              label={{ value: 'Current', position: 'right', fill: '#3b82f6', fontSize: 11 }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke={isProfit ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              fill="url(#liveBalanceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
