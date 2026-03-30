'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { LiveTrade } from '../../lib/live-types';
import EquityChart from '../shared/EquityChart';

interface LiveEquityChartProps {
  trades: LiveTrade[];
  balance: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function LiveEquityChart({ trades, balance }: LiveEquityChartProps) {
  const { chartData, startingBalance } = useMemo(() => {
    if (trades.length === 0) return { chartData: [], startingBalance: balance };

    const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
    const totalPnl = sorted.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    const start = balance - totalPnl;

    const points: { time: string; value: number }[] = [];

    // Initial point before first trade
    points.push({
      time: format(parseISO(sorted[0].close_time), 'MMM d, yyyy'),
      value: start,
    });

    let running = start;
    sorted.forEach((trade) => {
      const netPl = trade.profit + trade.commission + trade.swap;
      running += netPl;
      points.push({
        time: format(parseISO(trade.close_time), 'MMM d, yyyy HH:mm'),
        value: running,
      });
    });

    return { chartData: points, startingBalance: start };
  }, [trades, balance]);

  const totalChange = balance - startingBalance;
  const totalChangePct = startingBalance > 0 ? (totalChange / startingBalance) * 100 : 0;
  const isProfit = totalChange >= 0;

  if (chartData.length < 2) return null;

  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Equity Curve</h3>
          <p className="text-xs text-text-muted mt-1 font-mono">
            Balance progression from {trades.length} closed trades
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {isProfit ? '+' : ''}{totalChangePct.toFixed(2)}%
          </p>
          <p className={`text-sm font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {isProfit ? '+' : ''}{formatCurrency(totalChange)}
          </p>
        </div>
      </div>

      <EquityChart
        data={chartData}
        height={300}
        showReferenceLine={true}
        referenceValue={startingBalance}
        formatXLabel={(v) => {
          const parts = v.split(', ');
          return parts[0] ?? v;
        }}
      />
    </div>
  );
}
