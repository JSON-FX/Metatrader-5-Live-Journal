'use client';

import { TrendingUp, TrendingDown, Target, BarChart3, Clock, Percent, DollarSign, Activity, GitMerge, AlertTriangle, Trophy, XCircle, Shield } from 'lucide-react';
import { MT5Report } from '../lib/types';

interface ReportStatsProps {
  report: MT5Report;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  highlight?: 'green' | 'red' | 'orange' | 'blue';
}

function StatCard({ title, value, subtitle, icon, trend, highlight }: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-zinc-400';

  const borderColor = highlight === 'green' ? 'border-emerald-500/30'
    : highlight === 'red' ? 'border-red-500/30'
    : highlight === 'orange' ? 'border-orange-500/30'
    : highlight === 'blue' ? 'border-blue-500/30'
    : 'border-zinc-800';

  return (
    <div className={`bg-zinc-900 rounded-xl p-4 border ${borderColor}`}>
      <div className="flex items-start justify-between">
        <div className="p-2 bg-zinc-800 rounded-lg">
          {icon}
        </div>
        {trend && trend !== 'neutral' && (
          <span className={trendColor}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-400 mt-3">{title}</p>
      <p className={`text-xl font-bold mt-1 ${trendColor}`}>{value}</p>
      {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function ReportStats({ report }: ReportStatsProps) {
  const { results, tradeStats, settings } = report;
  const netProfitPercent = (results.totalNetProfit / settings.initialDeposit) * 100;

  // Calculate risk per trade from inputs
  const riskValue = settings.inputs?.RiskValue as number || 0;
  const riskMode = settings.inputs?.RiskMode as number;
  const riskPerTrade = riskMode === 0 ? riskValue : 0; // Mode 0 = percentage risk
  const isEstimatedRisk = settings.inputs?._isEstimated as boolean || false;

  // Calculate total equity exposure (sum of risk across all positions if running simultaneously)
  // For merged reports, use the pre-calculated combined risk from source reports
  // For single reports, exposure equals risk per trade
  const totalRiskExposure = report.isMerged && report.combinedRiskExposure !== undefined
    ? report.combinedRiskExposure
    : riskPerTrade;

  // For merged reports, show the individual risk values
  const riskBreakdown = report.isMerged && report.sourceRiskValues
    ? report.sourceRiskValues.map((r, i) => `${report.sourceReportNames?.[i] || `Report ${i+1}`}: ${r}%`).join(', ')
    : null;

  // Calculate the highest drawdown between balance and equity
  const highestDrawdownPercent = Math.max(
    results.balanceDrawdownMaximalPercent,
    results.equityDrawdownMaximalPercent
  );
  const highestDrawdownAmount = Math.max(
    results.balanceDrawdownMaximal,
    results.equityDrawdownMaximal
  );

  // For merged reports, calculate worst-case combined drawdown
  const worstCaseDrawdown = report.worstCaseDrawdown;
  const sourceDrawdowns = report.sourceDrawdowns;

  // Risk-adjusted return (return per unit of max drawdown)
  const riskAdjustedReturn = highestDrawdownPercent > 0
    ? (netProfitPercent / highestDrawdownPercent).toFixed(2)
    : 'N/A';

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {report.isMerged && <GitMerge className="w-5 h-5 text-orange-400" />}
              <h2 className="text-xl font-bold text-white">{report.name}</h2>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              {report.isMerged && report.sourceReportNames
                ? `Merged from: ${report.sourceReportNames.join(', ')}`
                : settings.expert
              }
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
              {settings.symbol.replace('_tickstory', '')}
            </span>
            <span className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm">
              {settings.period}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm ${
              report.type === 'merged'
                ? 'bg-orange-500/20 text-orange-400'
                : report.type === 'backtest'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {report.type === 'merged' ? 'Merged Report' : report.type === 'backtest' ? 'Backtest' : 'Forward Test'}
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Net Profit"
          value={formatCurrency(results.totalNetProfit)}
          subtitle={formatPercent(netProfitPercent)}
          icon={<DollarSign className="w-5 h-5 text-zinc-400" />}
          trend={results.totalNetProfit >= 0 ? 'up' : 'down'}
        />
        <StatCard
          title="Profit Factor"
          value={results.profitFactor.toFixed(2)}
          subtitle={results.profitFactor >= 1.5 ? 'Good' : results.profitFactor >= 1 ? 'Marginal' : 'Poor'}
          icon={<Target className="w-5 h-5 text-zinc-400" />}
          trend={results.profitFactor >= 1 ? 'up' : 'down'}
        />
        <StatCard
          title="Win Rate"
          value={`${tradeStats.profitTradesPercent.toFixed(1)}%`}
          subtitle={`${tradeStats.profitTrades} / ${tradeStats.totalTrades} trades`}
          icon={<Percent className="w-5 h-5 text-zinc-400" />}
          trend={tradeStats.profitTradesPercent >= 50 ? 'up' : 'down'}
        />
        <StatCard
          title="Avg Trade"
          value={formatCurrency(results.expectedPayoff)}
          subtitle="Expected payoff"
          icon={<TrendingUp className="w-5 h-5 text-zinc-400" />}
          trend={results.expectedPayoff >= 0 ? 'up' : 'down'}
        />
      </div>

      {/* Risk Metrics Section */}
      <div>
        <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Risk Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Risk per Trade"
            value={riskPerTrade > 0 ? `${riskPerTrade}%` : 'N/A'}
            subtitle={riskPerTrade > 0
              ? (isEstimatedRisk
                  ? `~${formatCurrency(settings.initialDeposit * riskPerTrade / 100)} avg loss`
                  : `${formatCurrency(settings.initialDeposit * riskPerTrade / 100)} per trade`)
              : 'Fixed lot mode'}
            icon={<Shield className="w-5 h-5 text-blue-400" />}
            trend="neutral"
            highlight="blue"
          />
          <StatCard
            title="Total Exposure"
            value={totalRiskExposure > 0 ? `${totalRiskExposure}%` : 'N/A'}
            subtitle={report.isMerged
              ? `${report.sourceRiskValues?.filter(r => r > 0).map(r => `${r}%`).join(' + ') || 'N/A'}`
              : (isEstimatedRisk ? 'Estimated from trades' : 'Single setup')}
            icon={<AlertTriangle className="w-5 h-5 text-orange-400" />}
            trend={totalRiskExposure > 10 ? 'down' : 'neutral'}
            highlight="orange"
          />
          <StatCard
            title="Highest Drawdown"
            value={`-${highestDrawdownPercent.toFixed(2)}%`}
            subtitle={report.isMerged && sourceDrawdowns
              ? `Worst single: ${sourceDrawdowns.map(d => `${d.toFixed(1)}%`).join(', ')}`
              : formatCurrency(-highestDrawdownAmount)}
            icon={<TrendingDown className="w-5 h-5 text-red-400" />}
            trend="down"
            highlight="red"
          />
          {report.isMerged && worstCaseDrawdown ? (
            <StatCard
              title="Worst Case DD"
              value={`-${worstCaseDrawdown.toFixed(2)}%`}
              subtitle={`If all DDs hit simultaneously`}
              icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
              trend="down"
              highlight="red"
            />
          ) : (
            <StatCard
              title="Risk-Adjusted Return"
              value={riskAdjustedReturn}
              subtitle="Return / Max DD"
              icon={<Activity className="w-5 h-5 text-zinc-400" />}
              trend={parseFloat(riskAdjustedReturn) >= 1 ? 'up' : 'neutral'}
            />
          )}
        </div>
      </div>

      {/* Consecutive Wins/Losses & Performance */}
      <div>
        <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Streak Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Max Consecutive Wins"
            value={`${tradeStats.maxConsecutiveWins}`}
            subtitle={formatCurrency(tradeStats.maxConsecutiveWinsAmount)}
            icon={<Trophy className="w-5 h-5 text-emerald-400" />}
            trend="up"
            highlight="green"
          />
          <StatCard
            title="Max Consecutive Losses"
            value={`${tradeStats.maxConsecutiveLosses}`}
            subtitle={formatCurrency(-Math.abs(tradeStats.maxConsecutiveLossesAmount))}
            icon={<XCircle className="w-5 h-5 text-red-400" />}
            trend="down"
            highlight="red"
          />
          <StatCard
            title="Sharpe Ratio"
            value={results.sharpeRatio.toFixed(2)}
            subtitle={results.sharpeRatio >= 2 ? 'Excellent' : results.sharpeRatio >= 1 ? 'Good' : 'Moderate'}
            icon={<Activity className="w-5 h-5 text-zinc-400" />}
            trend={results.sharpeRatio >= 1 ? 'up' : 'neutral'}
          />
          <StatCard
            title="Recovery Factor"
            value={results.recoveryFactor.toFixed(2)}
            subtitle="Net profit / Max DD"
            icon={<BarChart3 className="w-5 h-5 text-zinc-400" />}
            trend={results.recoveryFactor >= 1 ? 'up' : 'neutral'}
          />
        </div>
      </div>

      {/* Detailed Stats Tables */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Trade Breakdown */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h3 className="text-lg font-semibold text-white mb-4">Trade Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Total Trades</span>
              <span className="text-white font-medium">{tradeStats.totalTrades}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Long Trades (won)</span>
              <span className="text-white font-medium">{tradeStats.longTrades} ({tradeStats.longWonPercent.toFixed(1)}%)</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Short Trades (won)</span>
              <span className="text-white font-medium">{tradeStats.shortTrades} ({tradeStats.shortWonPercent.toFixed(1)}%)</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Largest Win</span>
              <span className="text-emerald-500 font-medium">{formatCurrency(tradeStats.largestProfitTrade)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Largest Loss</span>
              <span className="text-red-500 font-medium">{formatCurrency(tradeStats.largestLossTrade)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Avg Win</span>
              <span className="text-emerald-500 font-medium">{formatCurrency(tradeStats.averageProfitTrade)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Avg Loss</span>
              <span className="text-red-500 font-medium">{formatCurrency(tradeStats.averageLossTrade)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-zinc-400">Avg Holding Time</span>
              <span className="text-white font-medium">{tradeStats.avgHoldingTime || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Profit/Loss Summary */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h3 className="text-lg font-semibold text-white mb-4">Profit & Loss</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Gross Profit</span>
              <span className="text-emerald-500 font-medium">{formatCurrency(results.grossProfit)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Gross Loss</span>
              <span className="text-red-500 font-medium">{formatCurrency(results.grossLoss)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Net Profit</span>
              <span className={`font-medium ${results.totalNetProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {formatCurrency(results.totalNetProfit)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Initial Deposit</span>
              <span className="text-white font-medium">{formatCurrency(settings.initialDeposit)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Final Balance</span>
              <span className="text-white font-medium">{formatCurrency(settings.initialDeposit + results.totalNetProfit)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Balance Drawdown</span>
              <span className="text-red-500 font-medium">-{results.balanceDrawdownMaximalPercent.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Equity Drawdown</span>
              <span className="text-red-500 font-medium">-{results.equityDrawdownMaximalPercent.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-zinc-400">Return on DD</span>
              <span className={`font-medium ${netProfitPercent / highestDrawdownPercent >= 1 ? 'text-emerald-500' : 'text-zinc-400'}`}>
                {(netProfitPercent / highestDrawdownPercent).toFixed(2)}x
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Settings */}
      {Object.keys(settings.inputs).filter(k => !k.startsWith('_')).length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h3 className="text-lg font-semibold text-white mb-4">Strategy Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(settings.inputs)
              .filter(([key]) => !key.startsWith('_'))
              .map(([key, value]) => (
              <div key={key} className="py-2">
                <p className="text-xs text-zinc-500">{key}</p>
                <p className="text-sm text-white font-medium mt-1">
                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
