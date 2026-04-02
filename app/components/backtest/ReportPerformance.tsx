'use client';

import { useMemo } from 'react';
import { MT5Report } from '../../lib/types';
import { DisplayMode } from '../../lib/live-types';
import { formatValue } from '../../lib/trade-stats';
import StatCard from '../shared/StatCard';

interface ReportPerformanceProps {
  report: MT5Report;
  displayMode: DisplayMode;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ReportPerformance({ report, displayMode }: ReportPerformanceProps) {
  const { deals, settings, results } = report;
  const initialDeposit = settings.initialDeposit || 1000;

  const grid = useMemo(() => {
    const allDeals = deals.filter(d => d.symbol);
    const monthMap = new Map<string, number>();

    allDeals.forEach(deal => {
      const normalizedTime = deal.time.replace(/[\/\.]/g, '-');
      const date = new Date(normalizedTime);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const pnl = deal.profit + (deal.commission || 0) + (deal.swap || 0);
      monthMap.set(key, (monthMap.get(key) || 0) + pnl);
    });

    const yearSet = new Set<number>();
    monthMap.forEach((_, key) => yearSet.add(parseInt(key.split('-')[0])));
    const years = Array.from(yearSet).sort((a, b) => b - a);

    return years.map(year => {
      const months: (number | null)[] = Array(12).fill(null);
      for (let m = 0; m < 12; m++) {
        const val = monthMap.get(`${year}-${m}`);
        if (val !== undefined) months[m] = val;
      }
      const total = months.reduce((sum, m) => sum + (m ?? 0), 0);
      return { year, months, total };
    });
  }, [deals]);

  // Risk calculations
  const netProfitPercent = (results.totalNetProfit / initialDeposit) * 100;
  const highestDrawdownPercent = Math.max(
    results.balanceDrawdownMaximalPercent,
    results.equityDrawdownMaximalPercent
  );
  const riskValue = settings.inputs?.RiskValue as number || 0;
  const riskMode = settings.inputs?.RiskMode as number;
  const riskPerTrade = riskMode === 0 ? riskValue : 0;
  const isEstimatedRisk = settings.inputs?._isEstimated as boolean || false;
  const totalRiskExposure = report.isMerged && report.combinedRiskExposure !== undefined
    ? report.combinedRiskExposure
    : riskPerTrade;
  const riskAdjustedReturn = highestDrawdownPercent > 0
    ? (netProfitPercent / highestDrawdownPercent).toFixed(2)
    : 'N/A';

  const hasRiskData = riskPerTrade > 0 || (report.isMerged && report.combinedRiskExposure !== undefined);

  return (
    <div className="space-y-6 pt-6">
      {/* Yearly grid — clean table matching live PerformanceTab */}
      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[10px] text-text-muted uppercase tracking-wider font-medium px-3 py-2.5">Year</th>
              {MONTH_LABELS.map(m => (
                <th key={m} className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium px-1.5 py-2.5">{m}</th>
              ))}
              <th className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium px-3 py-2.5">Total</th>
            </tr>
          </thead>
          <tbody>
            {grid.map(({ year, months, total }) => (
              <tr key={year} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2.5 text-sm font-semibold text-text-primary">{year}</td>
                {months.map((pnl, i) => (
                  <td key={i} className="px-1.5 py-2.5 text-center">
                    {pnl !== null ? (
                      <span className={`text-xs font-mono font-medium ${pnl >= 0 ? 'text-accent' : 'text-loss'}`}>
                        {formatValue(pnl, displayMode, { startingCapital: initialDeposit })}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs font-mono font-semibold ${total >= 0 ? 'text-accent' : 'text-loss'}`}>
                    {formatValue(total, displayMode, { startingCapital: initialDeposit })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Risk breakdown */}
      {hasRiskData && (
        <div>
          <p className="text-[11px] text-text-muted uppercase tracking-[1px] mb-3">Risk Breakdown</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Risk per Trade"
              value={riskPerTrade > 0 ? `${riskPerTrade}%` : 'N/A'}
              secondaryValue={
                riskPerTrade > 0
                  ? isEstimatedRisk
                    ? `~${formatCurrency(initialDeposit * riskPerTrade / 100)} avg`
                    : `${formatCurrency(initialDeposit * riskPerTrade / 100)} per trade`
                  : 'Fixed lot mode'
              }
              variant="accent"
            />
            <StatCard
              label="Total Exposure"
              value={totalRiskExposure > 0 ? `${totalRiskExposure}%` : 'N/A'}
              secondaryValue={
                report.isMerged
                  ? report.sourceRiskValues?.filter(r => r > 0).map(r => `${r}%`).join(' + ') || 'N/A'
                  : isEstimatedRisk ? 'Estimated' : 'Single setup'
              }
              variant={totalRiskExposure > 10 ? 'warning' : 'default'}
            />
            <StatCard
              label="Highest Drawdown"
              value={`-${highestDrawdownPercent.toFixed(2)}%`}
              secondaryValue={
                report.isMerged && report.sourceDrawdowns
                  ? `Worst: ${report.sourceDrawdowns.map(d => `${d.toFixed(1)}%`).join(', ')}`
                  : formatCurrency(-Math.max(results.balanceDrawdownMaximal, results.equityDrawdownMaximal))
              }
              variant="loss"
            />
            {report.isMerged && report.worstCaseDrawdown ? (
              <StatCard
                label="Worst Case DD"
                value={`-${report.worstCaseDrawdown.toFixed(2)}%`}
                secondaryValue="If all DDs hit simultaneously"
                variant="loss"
              />
            ) : (
              <StatCard
                label="Risk-Adjusted Return"
                value={riskAdjustedReturn}
                secondaryValue="Return / Max DD"
                variant={parseFloat(riskAdjustedReturn) >= 1 ? 'profit' : 'default'}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
