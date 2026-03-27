'use client';

import { Trash2, BarChart2, Calendar, TrendingUp, TrendingDown, GitMerge, Check } from 'lucide-react';
import { MT5Report } from '../lib/types';
import { format, parseISO } from 'date-fns';

interface ReportListProps {
  reports: MT5Report[];
  selectedReportId: string | null;
  onSelectReport: (id: string) => void;
  onDeleteReport: (id: string) => void;
  // Merge mode props
  mergeMode?: boolean;
  selectedForMerge?: string[];
  onToggleMergeSelect?: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function getSymbol(report: MT5Report): string {
  return report.settings.symbol.replace('_tickstory', '').toUpperCase();
}

export default function ReportList({
  reports,
  selectedReportId,
  onSelectReport,
  onDeleteReport,
  mergeMode = false,
  selectedForMerge = [],
  onToggleMergeSelect
}: ReportListProps) {
  if (reports.length === 0) {
    return null;
  }

  // Get the symbol of the first selected report for merge validation
  const firstSelectedSymbol = selectedForMerge.length > 0
    ? getSymbol(reports.find(r => r.id === selectedForMerge[0])!)
    : null;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-lg font-semibold text-white">
          {mergeMode ? 'Select Reports to Merge' : 'Imported Reports'}
        </h3>
        <p className="text-sm text-zinc-400 mt-1">
          {mergeMode
            ? `${selectedForMerge.length} selected (same symbol only)`
            : `${reports.length} report${reports.length !== 1 ? 's' : ''}`
          }
        </p>
      </div>

      <div className="divide-y divide-zinc-800 max-h-[400px] overflow-y-auto">
        {reports.map((report) => {
          const isSelected = report.id === selectedReportId;
          const isProfit = report.results.totalNetProfit >= 0;
          const profitPercent = (report.results.totalNetProfit / report.settings.initialDeposit) * 100;
          const reportSymbol = getSymbol(report);

          // Merge mode logic
          const isSelectedForMerge = selectedForMerge.includes(report.id);
          const canSelectForMerge = !firstSelectedSymbol || reportSymbol === firstSelectedSymbol;
          const isDisabledForMerge = mergeMode && !canSelectForMerge && !isSelectedForMerge;

          return (
            <div
              key={report.id}
              className={`p-4 transition-colors ${
                isDisabledForMerge
                  ? 'opacity-40 cursor-not-allowed'
                  : 'cursor-pointer'
              } ${
                mergeMode
                  ? isSelectedForMerge
                    ? 'bg-orange-500/10 border-l-2 border-l-orange-500'
                    : 'hover:bg-zinc-800/50 border-l-2 border-l-transparent'
                  : isSelected
                    ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                    : 'hover:bg-zinc-800/50 border-l-2 border-l-transparent'
              }`}
              onClick={() => {
                if (isDisabledForMerge) return;
                if (mergeMode && onToggleMergeSelect) {
                  onToggleMergeSelect(report.id);
                } else {
                  onSelectReport(report.id);
                }
              }}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Checkbox for merge mode */}
                {mergeMode && (
                  <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isSelectedForMerge
                      ? 'bg-orange-500 border-orange-500'
                      : isDisabledForMerge
                        ? 'border-zinc-700'
                        : 'border-zinc-600 hover:border-zinc-500'
                  }`}>
                    {isSelectedForMerge && <Check className="w-3 h-3 text-white" />}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {report.isMerged ? (
                      <GitMerge className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    ) : (
                      <BarChart2 className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    )}
                    <h4 className="text-sm font-medium text-white truncate">
                      {report.name}
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                      {reportSymbol}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      report.type === 'merged'
                        ? 'bg-orange-500/20 text-orange-400'
                        : report.type === 'backtest'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {report.type === 'merged' ? 'Merged' : report.type === 'backtest' ? 'Backtest' : 'Forward'}
                    </span>
                    <span className={`flex items-center gap-1 text-xs ${
                      isProfit ? 'text-emerald-500' : 'text-red-500'
                    }`}>
                      {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isProfit ? '+' : ''}{profitPercent.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(report.importedAt), 'MMM d, yyyy')}
                    </span>
                    <span>
                      {report.tradeStats.totalTrades} trades
                    </span>
                    <span className={isProfit ? 'text-emerald-500' : 'text-red-500'}>
                      {formatCurrency(report.results.totalNetProfit)}
                    </span>
                  </div>

                  {/* Show source reports for merged */}
                  {report.isMerged && report.sourceReportNames && (
                    <p className="text-xs text-zinc-600 mt-1 truncate">
                      From: {report.sourceReportNames.join(', ')}
                    </p>
                  )}
                </div>

                {!mergeMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteReport(report.id);
                    }}
                    className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete report"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
