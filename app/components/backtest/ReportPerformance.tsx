'use client';

import { useState, useMemo } from 'react';
import { MT5Report } from '../../lib/types';
import StatCard from '../shared/StatCard';

interface ReportPerformanceProps {
  report: MT5Report;
}

interface MonthData {
  profit: number;
  percent: number;
  trades: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ReportPerformance({ report }: ReportPerformanceProps) {
  const [displayMode, setDisplayMode] = useState<'currency' | 'percent'>('currency');
  const { deals, settings, results } = report;

  const { yearlyData, years } = useMemo(() => {
    const allDeals = deals.filter(d => d.symbol);
    const initialDeposit = settings.initialDeposit || 1000;
    const data: Record<number, Record<number, MonthData>> = {};

    allDeals.forEach(deal => {
      const normalizedTime = deal.time.replace(/[\/\.]/g, '-');
      const date = new Date(normalizedTime);
      const year = date.getFullYear();
      const month = date.getMonth();

      if (!data[year]) data[year] = {};
      if (!data[year][month]) data[year][month] = { profit: 0, percent: 0, trades: 0 };

      data[year][month].profit += deal.profit + (deal.commission || 0) + (deal.swap || 0);
      if (deal.direction === 'out') data[year][month].trades += 1;
    });

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

  const getYearTotal = (year: number) => {
    if (!yearlyData[year]) return null;
    let totalProfit = 0;
    let totalTrades = 0;
    Object.values(yearlyData[year]).forEach(m => {
      totalProfit += m.profit;
      totalTrades += m.trades;
    });
    if (totalTrades === 0) return null;
    const percent = (totalProfit / (settings.initialDeposit || 1000)) * 100;
    return { profit: totalProfit, percent, trades: totalTrades };
  };

  const formatValue = (data: MonthData | undefined): string | null => {
    if (!data || data.trades === 0) return null;
    if (displayMode === 'currency') {
      const absValue = Math.abs(data.profit);
      if (absValue >= 1000) return `${data.profit >= 0 ? '+' : '-'}$${(absValue / 1000).toFixed(0)}k`;
      return `${data.profit >= 0 ? '+' : ''}${Math.round(data.profit)}`;
    }
    return `${data.percent >= 0 ? '+' : ''}${data.percent.toFixed(1)}%`;
  };

  // Risk calculations (from ReportStats logic)
  const netProfitPercent = (results.totalNetProfit / settings.initialDeposit) * 100;
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
    <div className="space-y-6">
      {/* Yearly grid */}
      <div className="bg-bg-secondary border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] text-text-muted uppercase tracking-[1px]">Yearly Performance</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDisplayMode('currency')}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                displayMode === 'currency'
                  ? 'bg-bg-tertiary text-text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              $
            </button>
            <button
              onClick={() => setDisplayMode('percent')}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                displayMode === 'percent'
                  ? 'bg-bg-tertiary text-text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              %
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                <th className="text-left text-[10px] text-text-muted uppercase tracking-[1px] font-normal py-2 px-1 w-12"></th>
                {MONTHS.map(m => (
                  <th key={m} className="text-center text-[10px] text-text-muted uppercase tracking-[1px] font-normal py-2 px-1">
                    {m}
                  </th>
                ))}
                <th className="text-center text-[10px] text-text-muted uppercase tracking-[1px] font-normal py-2 px-1">YTD</th>
              </tr>
            </thead>
            <tbody>
              {years.map(year => {
                const yearTotal = getYearTotal(year);
                return (
                  <tr key={year}>
                    <td className="text-left text-xs font-mono text-text-secondary py-2 px-1">{year}</td>
                    {MONTHS.map((_, monthIndex) => {
                      const monthData = yearlyData[year]?.[monthIndex];
                      const value = formatValue(monthData);
                      return (
                        <td key={monthIndex} className="text-center py-2 px-1">
                          <div className={`rounded-md p-1.5 min-h-[44px] flex flex-col justify-center items-center ${
                            monthData && monthData.trades > 0
                              ? monthData.profit >= 0
                                ? 'border border-accent/20 bg-accent/5'
                                : 'border border-loss/20 bg-loss/5'
                              : 'bg-bg-tertiary/30'
                          }`}>
                            {value ? (
                              <>
                                <div className={`text-xs font-mono font-medium ${
                                  monthData!.profit >= 0 ? 'text-accent' : 'text-loss'
                                }`}>
                                  {value}
                                </div>
                                <div className="text-[10px] text-text-muted">
                                  {monthData!.trades}t
                                </div>
                              </>
                            ) : (
                              <span className="text-text-muted opacity-30 text-xs">—</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center py-2 px-1">
                      <div className={`rounded-md p-1.5 min-h-[44px] flex flex-col justify-center items-center ${
                        yearTotal
                          ? yearTotal.profit >= 0
                            ? 'border border-accent/40 bg-accent/10'
                            : 'border border-loss/40 bg-loss/10'
                          : 'bg-bg-tertiary/30'
                      }`}>
                        {yearTotal ? (
                          <>
                            <div className={`text-xs font-mono font-medium ${
                              yearTotal.profit >= 0 ? 'text-accent' : 'text-loss'
                            }`}>
                              {displayMode === 'currency'
                                ? `${yearTotal.profit >= 0 ? '+' : ''}${Math.round(yearTotal.profit)}`
                                : `${yearTotal.percent >= 0 ? '+' : ''}${yearTotal.percent.toFixed(1)}%`}
                            </div>
                            <div className="text-[10px] text-text-muted">{yearTotal.trades}t</div>
                          </>
                        ) : (
                          <span className="text-text-muted opacity-30 text-xs">—</span>
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
                    ? `~${formatCurrency(settings.initialDeposit * riskPerTrade / 100)} avg`
                    : `${formatCurrency(settings.initialDeposit * riskPerTrade / 100)} per trade`
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
