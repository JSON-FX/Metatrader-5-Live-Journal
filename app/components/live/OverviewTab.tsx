'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { LiveTrade } from '../../lib/live-types';
import { calculateStats, calculateEquityCurve } from '../../lib/trade-stats';
import StatCard from '../shared/StatCard';
import EquityChart from '../shared/EquityChart';

interface OverviewTabProps {
  trades: LiveTrade[];
  balance: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

export default function OverviewTab({ trades, balance }: OverviewTabProps) {
  const startingCapital = useMemo(() => {
    const totalPnl = trades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    return balance - totalPnl;
  }, [trades, balance]);

  const stats = useMemo(() => calculateStats(trades, startingCapital), [trades, startingCapital]);

  const equityCurve = useMemo(() => {
    const points = calculateEquityCurve(trades, startingCapital);
    return points.map(p => ({
      time: format(parseISO(p.time), 'MMM d, yyyy'),
      value: p.value,
    }));
  }, [trades, startingCapital]);

  if (trades.length === 0) {
    return (
      <div className="py-16 text-center text-text-muted text-sm">No trades yet</div>
    );
  }

  const pfDisplay = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2);
  const netVariant = stats.netProfit >= 0 ? 'profit' : 'loss';

  return (
    <div className="space-y-6 pt-6">
      {/* Row 1: Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Net Profit" value={formatCurrency(stats.netProfit)} variant={netVariant} />
        <StatCard label="Profit Factor" value={pfDisplay} />
        <StatCard label="Total Trades" value={String(stats.totalTrades)} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
        <StatCard label="Expected Payoff" value={formatCurrency(stats.expectedPayoff)} variant={stats.expectedPayoff >= 0 ? 'profit' : 'loss'} />
      </div>

      {/* Row 2: Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Gross Profit" value={formatCurrency(stats.grossProfit)} variant="profit" />
        <StatCard label="Gross Loss" value={formatCurrency(-stats.grossLoss)} variant="loss" />
        <StatCard
          label="Max Drawdown"
          value={formatCurrency(-stats.maxDrawdown)}
          secondaryValue={`${stats.maxDrawdownPct.toFixed(2)}%`}
          variant="loss"
        />
        <StatCard label="Commission + Swap" value={formatCurrency(stats.totalCommissionSwap)} />
        <StatCard
          label="Best / Worst"
          value={formatCurrency(stats.bestTrade)}
          secondaryValue={formatCurrency(stats.worstTrade)}
        />
      </div>

      {/* Equity curve */}
      {equityCurve.length >= 2 && (
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Equity Curve</h3>
              <p className="text-xs text-text-muted mt-1 font-mono">
                Balance progression from {trades.length} closed trades
              </p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold font-mono ${stats.netProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {stats.netProfit >= 0 ? '+' : ''}{startingCapital > 0 ? ((stats.netProfit / startingCapital) * 100).toFixed(2) : '0.00'}%
              </p>
              <p className={`text-sm font-mono ${stats.netProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {stats.netProfit >= 0 ? '+' : ''}{formatCurrency(stats.netProfit)}
              </p>
            </div>
          </div>
          <EquityChart
            data={equityCurve}
            height={300}
            showReferenceLine={true}
            referenceValue={startingCapital}
            formatXLabel={(v) => v.split(', ')[0] ?? v}
          />
        </div>
      )}
    </div>
  );
}
