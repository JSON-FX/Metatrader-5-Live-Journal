'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { LiveTrade, DisplayMode } from '../../lib/live-types';
import { calculateStats, calculateEquityCurve, formatValue } from '../../lib/trade-stats';
import StatCard from '../shared/StatCard';
import EquityChart from '../shared/EquityChart';

interface OverviewTabProps {
  trades: LiveTrade[];
  startingCapital: number;
  displayMode: DisplayMode;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

export default function OverviewTab({ trades, startingCapital, displayMode }: OverviewTabProps) {
  const stats = useMemo(() => calculateStats(trades, startingCapital), [trades, startingCapital]);

  const equityCurve = useMemo(() => {
    const points = calculateEquityCurve(trades, startingCapital);
    return points.map(p => ({
      time: format(parseISO(p.time), 'MMM d, yyyy'),
      rawTime: p.time,
      value: p.value,
    }));
  }, [trades, startingCapital]);

  // Date range for equity curve filtering
  const dateRange = useMemo(() => {
    if (equityCurve.length === 0) return { min: '', max: '' };
    const min = equityCurve[0].rawTime.slice(0, 10);
    const max = equityCurve[equityCurve.length - 1].rawTime.slice(0, 10);
    return { min, max };
  }, [equityCurve]);

  const [curveStart, setCurveStart] = useState('');
  const [curveEnd, setCurveEnd] = useState('');

  const filteredEquityCurve = useMemo(() => {
    if (!curveStart && !curveEnd) return equityCurve;
    return equityCurve.filter(p => {
      const d = p.rawTime.slice(0, 10);
      if (curveStart && d < curveStart) return false;
      if (curveEnd && d > curveEnd) return false;
      return true;
    });
  }, [equityCurve, curveStart, curveEnd]);

  if (trades.length === 0) {
    return (
      <div className="py-16 text-center text-text-muted text-sm">No trades yet</div>
    );
  }

  const fmt = (pnl: number) => formatValue(pnl, displayMode, { startingCapital });
  const pfDisplay = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2);
  const netVariant = stats.netProfit >= 0 ? 'profit' : 'loss';

  return (
    <div className="space-y-6 pt-6">
      {/* Row 1: Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Net Profit" value={fmt(stats.netProfit)} variant={netVariant} />
        <StatCard label="Profit Factor" value={pfDisplay} />
        <StatCard label="Total Trades" value={String(stats.totalTrades)} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
        <StatCard label="Expected Payoff" value={fmt(stats.expectedPayoff)} variant={stats.expectedPayoff >= 0 ? 'profit' : 'loss'} />
      </div>

      {/* Row 2: Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Gross Profit" value={fmt(stats.grossProfit)} variant="profit" />
        <StatCard label="Gross Loss" value={fmt(-stats.grossLoss)} variant="loss" />
        <StatCard
          label="Max Drawdown"
          value={fmt(-stats.maxDrawdown)}
          secondaryValue={`${stats.maxDrawdownPct.toFixed(2)}%`}
          variant="loss"
        />
        <StatCard label="Commission + Swap" value={formatCurrency(stats.totalCommissionSwap)} />
        <StatCard
          label="Best / Worst"
          value={fmt(stats.bestTrade)}
          secondaryValue={fmt(stats.worstTrade)}
        />
      </div>

      {/* Equity curve */}
      {equityCurve.length >= 2 && (() => {
        const curveData = filteredEquityCurve;
        const curveReturn = curveData.length >= 2
          ? curveData[curveData.length - 1].value - curveData[0].value
          : 0;
        const curveStartValue = curveData.length >= 1 ? curveData[0].value : startingCapital;
        const curveReturnPct = curveStartValue > 0 ? (curveReturn / curveStartValue) * 100 : 0;
        const isFiltered = curveStart || curveEnd;

        return (
          <div className="bg-bg-secondary border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Equity Curve</h3>
                <p className="text-xs text-text-muted mt-1 font-mono">
                  Balance progression from {isFiltered ? `${curveData.length} of ${equityCurve.length}` : equityCurve.length} data points
                </p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold font-mono ${curveReturn >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {curveReturn >= 0 ? '+' : ''}{curveReturnPct.toFixed(2)}%
                </p>
                <p className={`text-sm font-mono ${curveReturn >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {curveReturn >= 0 ? '+' : ''}{formatCurrency(curveReturn)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <label className="text-xs text-text-muted font-mono">From</label>
              <input
                type="date"
                value={curveStart}
                min={dateRange.min}
                max={curveEnd || dateRange.max}
                onChange={(e) => setCurveStart(e.target.value)}
                className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <label className="text-xs text-text-muted font-mono">To</label>
              <input
                type="date"
                value={curveEnd}
                min={curveStart || dateRange.min}
                max={dateRange.max}
                onChange={(e) => setCurveEnd(e.target.value)}
                className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {isFiltered && (
                <button
                  onClick={() => { setCurveStart(''); setCurveEnd(''); }}
                  className="text-xs text-text-muted hover:text-text-primary font-mono transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
            {curveData.length >= 2 ? (
              <EquityChart
                data={curveData}
                height={300}
                showReferenceLine={true}
                referenceValue={curveData[0].value}
                formatXLabel={(v) => v.split(', ')[0] ?? v}
              />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-text-muted text-sm font-mono">
                Not enough data points in selected range
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
