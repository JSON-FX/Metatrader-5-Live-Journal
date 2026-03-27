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
  ReferenceLine
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { MT5Report } from '../lib/types';

interface EquityChartProps {
  report: MT5Report;
  liveBalance?: number | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(dateStr: string): string {
  try {
    // Handle MT5 date format: "2025.01.02 05:02:19"
    const normalized = dateStr.replace(/\./g, '-').split(' ')[0];
    return format(parseISO(normalized), 'MMM d');
  } catch {
    return dateStr;
  }
}

interface TooltipPayload {
  date: string;
  balance: number;
  equity: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TooltipPayload }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-zinc-400 mb-2">{data.date}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm text-zinc-300">Balance:</span>
          <span className="text-sm font-semibold text-white">{formatCurrency(data.balance)}</span>
        </div>
      </div>
    </div>
  );
}

export default function EquityChart({ report, liveBalance }: EquityChartProps) {
  const chartData = useMemo(() => {
    // Build equity curve from deals if we have balance data
    const points: { date: string; balance: number; equity: number }[] = [];

    // Start with initial deposit
    const initialBalance = report.settings.initialDeposit;
    let runningBalance = initialBalance;

    // Add initial point
    if (report.deals.length > 0) {
      points.push({
        date: report.deals[0].time.split(' ')[0].replace(/\./g, '-'),
        balance: initialBalance,
        equity: initialBalance
      });
    }

    // Process deals with balance updates
    for (const deal of report.deals) {
      if (deal.balance > 0) {
        runningBalance = deal.balance;
        points.push({
          date: deal.time.replace(/\./g, '-'),
          balance: deal.balance,
          equity: deal.balance
        });
      }
    }

    // If no deal data, use the equity curve from parsing
    if (points.length === 0 && report.equityCurve.length > 0) {
      return report.equityCurve;
    }

    return points;
  }, [report]);

  const { minValue, maxValue, initialDeposit } = useMemo(() => {
    const balances = chartData.map(d => d.balance);
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const padding = (max - min) * 0.1;
    return {
      minValue: Math.floor((min - padding) / 100) * 100,
      maxValue: Math.ceil((max + padding) / 100) * 100,
      initialDeposit: report.settings.initialDeposit
    };
  }, [chartData, report.settings.initialDeposit]);

  const profitPercent = ((chartData[chartData.length - 1]?.balance || initialDeposit) - initialDeposit) / initialDeposit * 100;
  const isProfit = profitPercent >= 0;

  return (
    <div className="w-full bg-zinc-900 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Equity Curve</h3>
          <p className="text-sm text-zinc-400 mt-1">Balance progression over time</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
            {isProfit ? '+' : ''}{profitPercent.toFixed(2)}%
          </p>
          <p className="text-sm text-zinc-400">
            {formatCurrency(chartData[chartData.length - 1]?.balance || initialDeposit)}
          </p>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#71717a"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              domain={[minValue, maxValue]}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              stroke="#71717a"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={initialDeposit}
              stroke="#71717a"
              strokeDasharray="5 5"
              strokeOpacity={0.5}
            />
            {liveBalance != null && (
              <ReferenceLine
                y={liveBalance}
                stroke="#3b82f6"
                strokeDasharray="4 4"
                strokeOpacity={0.8}
                label={{ value: 'Live', position: 'right', fill: '#3b82f6', fontSize: 11 }}
              />
            )}
            <Area
              type="monotone"
              dataKey="balance"
              stroke={isProfit ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              fill="url(#balanceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
