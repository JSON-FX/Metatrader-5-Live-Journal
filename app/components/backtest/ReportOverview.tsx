'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { MT5Report } from '../../lib/types';
import StatCard from '../shared/StatCard';
import EquityChart from '../shared/EquityChart';

interface ReportOverviewProps {
  report: MT5Report;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ReportOverview({ report }: ReportOverviewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { results, tradeStats, settings } = report;

  const netProfitPercent = (results.totalNetProfit / settings.initialDeposit) * 100;

  const highestDrawdownPercent = Math.max(
    results.balanceDrawdownMaximalPercent,
    results.equityDrawdownMaximalPercent
  );
  const highestDrawdownAmount = Math.max(
    results.balanceDrawdownMaximal,
    results.equityDrawdownMaximal
  );

  // Build equity curve from deals
  const equityData = useMemo(() => {
    const dealsWithBalance = report.deals.filter(d => d.balance > 0);
    if (dealsWithBalance.length === 0) return [];

    const points: { time: string; value: number }[] = [
      { time: dealsWithBalance[0].time.split(' ')[0], value: settings.initialDeposit },
    ];

    for (const deal of dealsWithBalance) {
      const date = deal.time.split(' ')[0].replace(/[\/\.]/g, '-');
      points.push({ time: date, value: deal.balance });
    }

    return points;
  }, [report.deals, settings.initialDeposit]);

  const filteredInputs = Object.entries(settings.inputs).filter(([key]) => !key.startsWith('_'));

  return (
    <div className="space-y-6">
      {/* Row 1: Net Profit, Profit Factor, Total Trades, Win Rate */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Net Profit"
          value={formatCurrency(results.totalNetProfit)}
          secondaryValue={`${netProfitPercent >= 0 ? '+' : ''}${netProfitPercent.toFixed(2)}%`}
          variant={results.totalNetProfit >= 0 ? 'profit' : 'loss'}
        />
        <StatCard
          label="Profit Factor"
          value={results.profitFactor.toFixed(2)}
          secondaryValue={results.profitFactor >= 1.5 ? 'Good' : results.profitFactor >= 1 ? 'Marginal' : 'Poor'}
        />
        <StatCard
          label="Total Trades"
          value={String(tradeStats.totalTrades)}
          secondaryValue={`${tradeStats.profitTrades}W / ${tradeStats.lossTrades}L`}
        />
        <StatCard
          label="Win Rate"
          value={`${tradeStats.profitTradesPercent.toFixed(1)}%`}
          secondaryValue={`${tradeStats.profitTrades} of ${tradeStats.totalTrades}`}
          variant={tradeStats.profitTradesPercent >= 50 ? 'profit' : 'loss'}
        />
      </div>

      {/* Row 2: Expected Payoff, Sharpe Ratio, Max Drawdown, Recovery Factor */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Expected Payoff"
          value={formatCurrency(results.expectedPayoff)}
          secondaryValue="Per trade"
          variant={results.expectedPayoff >= 0 ? 'profit' : 'loss'}
        />
        <StatCard
          label="Sharpe Ratio"
          value={results.sharpeRatio.toFixed(2)}
          secondaryValue={results.sharpeRatio >= 2 ? 'Excellent' : results.sharpeRatio >= 1 ? 'Good' : 'Moderate'}
        />
        <StatCard
          label="Max Drawdown"
          value={`-${highestDrawdownPercent.toFixed(2)}%`}
          secondaryValue={formatCurrency(-highestDrawdownAmount)}
          variant="loss"
        />
        <StatCard
          label="Recovery Factor"
          value={results.recoveryFactor.toFixed(2)}
          secondaryValue="Net profit / Max DD"
          variant={results.recoveryFactor >= 1 ? 'profit' : 'warning'}
        />
      </div>

      {/* Row 3: Gross Profit, Gross Loss, Avg Win, Avg Loss */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Gross Profit"
          value={formatCurrency(results.grossProfit)}
          variant="profit"
        />
        <StatCard
          label="Gross Loss"
          value={formatCurrency(results.grossLoss)}
          variant="loss"
        />
        <StatCard
          label="Avg Win"
          value={formatCurrency(tradeStats.averageProfitTrade)}
          variant="profit"
        />
        <StatCard
          label="Avg Loss"
          value={formatCurrency(tradeStats.averageLossTrade)}
          variant="loss"
        />
      </div>

      {/* Equity Chart */}
      {equityData.length >= 2 && (
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-[1px] mb-4">Equity Curve</p>
          <EquityChart
            data={equityData}
            height={280}
            showReferenceLine
            referenceValue={settings.initialDeposit}
          />
        </div>
      )}

      {/* Strategy Settings (collapsible) */}
      <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setSettingsOpen(prev => !prev)}
          className="w-full flex items-center justify-between p-4 hover:bg-bg-tertiary/50 transition-colors"
        >
          <p className="text-[11px] text-text-muted uppercase tracking-[1px]">Strategy Settings</p>
          {settingsOpen
            ? <ChevronDown className="w-4 h-4 text-text-muted" />
            : <ChevronRight className="w-4 h-4 text-text-muted" />
          }
        </button>

        {settingsOpen && (
          <div className="border-t border-border p-4">
            {/* Core settings */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-[11px] text-text-muted uppercase tracking-[1px]">Symbol</p>
                <p className="text-sm font-mono text-text-primary mt-1">
                  {settings.symbol.replace('_tickstory', '').toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted uppercase tracking-[1px]">Period</p>
                <p className="text-sm font-mono text-text-primary mt-1">{settings.period}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted uppercase tracking-[1px]">Initial Deposit</p>
                <p className="text-sm font-mono text-text-primary mt-1">{formatCurrency(settings.initialDeposit)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted uppercase tracking-[1px]">Leverage</p>
                <p className="text-sm font-mono text-text-primary mt-1">{settings.leverage}</p>
              </div>
            </div>

            {/* EA Inputs */}
            {filteredInputs.length > 0 && (
              <>
                <div className="border-t border-border pt-4">
                  <p className="text-[11px] text-text-muted uppercase tracking-[1px] mb-3">EA Inputs</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {filteredInputs.map(([key, value]) => (
                      <div key={key}>
                        <p className="text-[11px] text-text-muted">{key}</p>
                        <p className="text-sm font-mono text-text-primary mt-1">
                          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
