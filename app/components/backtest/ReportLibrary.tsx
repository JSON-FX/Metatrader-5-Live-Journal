'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { LayoutGrid, List, ChevronDown } from 'lucide-react';
import { MT5Report } from '../../lib/types';
import ReportCard from './ReportCard';
import StatusBadge from '../shared/StatusBadge';
import DataTable, { Column } from '../shared/DataTable';

interface ReportLibraryProps {
  reports: MT5Report[];
  onDelete: (id: string) => void;
  mergeMode: boolean;
  selectedForMerge: string[];
  onToggleMerge: (id: string) => void;
}

type SortOption = 'date' | 'profit' | 'symbol';
type ViewMode = 'grid' | 'list';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getSymbol(report: MT5Report): string {
  return report.settings.symbol.replace('_tickstory', '').toUpperCase();
}

export default function ReportLibrary({
  reports,
  onDelete,
  mergeMode,
  selectedForMerge,
  onToggleMerge,
}: ReportLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortOpen, setSortOpen] = useState(false);

  const sortLabels: Record<SortOption, string> = {
    date: 'Date Imported',
    profit: 'Profit (High-Low)',
    symbol: 'Symbol (A-Z)',
  };

  const sorted = useMemo(() => {
    return [...reports].sort((a, b) => {
      if (sortBy === 'profit') {
        return b.results.totalNetProfit - a.results.totalNetProfit;
      }
      if (sortBy === 'symbol') {
        return getSymbol(a).localeCompare(getSymbol(b));
      }
      // date: newest first (default)
      return new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime();
    });
  }, [reports, sortBy]);

  // In merge mode, determine which reports are disabled (different symbol from first selected)
  const getMergeDisabled = (report: MT5Report): boolean => {
    if (!mergeMode || selectedForMerge.length === 0) return false;
    const firstSelected = reports.find(r => r.id === selectedForMerge[0]);
    if (!firstSelected) return false;
    return getSymbol(report) !== getSymbol(firstSelected);
  };

  const tableColumns: Column<MT5Report>[] = [
    {
      key: 'symbol',
      label: 'Symbol',
      sortable: true,
      sortValue: (r) => getSymbol(r),
      render: (r) => (
        <Link
          href={`/backtests/${r.id}`}
          className="font-mono font-semibold text-text-primary hover:text-accent transition-colors"
        >
          {getSymbol(r)}
        </Link>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (r) => {
        const variant: 'backtest' | 'forward' | 'merged' =
          r.type === 'merged' ? 'merged' : r.type === 'forward' ? 'forward' : 'backtest';
        return (
          <StatusBadge
            label={r.type.charAt(0).toUpperCase() + r.type.slice(1)}
            variant={variant}
          />
        );
      },
    },
    {
      key: 'profit',
      label: 'Net Profit',
      sortable: true,
      sortValue: (r) => r.results.totalNetProfit,
      align: 'right',
      render: (r) => (
        <span className={r.results.totalNetProfit >= 0 ? 'text-profit' : 'text-loss'}>
          {formatCurrency(r.results.totalNetProfit)}
        </span>
      ),
    },
    {
      key: 'pf',
      label: 'Profit Factor',
      sortable: true,
      sortValue: (r) => r.results.profitFactor,
      align: 'right',
      render: (r) => (
        <span className="text-text-primary">{r.results.profitFactor.toFixed(2)}</span>
      ),
    },
    {
      key: 'trades',
      label: 'Trades',
      sortable: true,
      sortValue: (r) => r.tradeStats.totalTrades,
      align: 'right',
      render: (r) => (
        <span className="text-text-secondary">{r.tradeStats.totalTrades}</span>
      ),
    },
    {
      key: 'winrate',
      label: 'Win Rate',
      sortable: true,
      sortValue: (r) => r.tradeStats.profitTradesPercent,
      align: 'right',
      render: (r) => (
        <span className={r.tradeStats.profitTradesPercent >= 50 ? 'text-profit' : 'text-loss'}>
          {r.tradeStats.profitTradesPercent.toFixed(1)}%
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-text-muted">
          {reports.length} report{reports.length === 1 ? '' : 's'}
        </p>

        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary bg-bg-secondary border border-border rounded-lg hover:border-accent/40 transition-colors"
            >
              {sortLabels[sortBy]}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 bg-bg-secondary border border-border rounded-lg shadow-lg z-10 min-w-[160px]">
                {(Object.keys(sortLabels) as SortOption[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setSortBy(opt); setSortOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-bg-tertiary transition-colors first:rounded-t-lg last:rounded-b-lg
                      ${sortBy === opt ? 'text-accent' : 'text-text-secondary'}`}
                  >
                    {sortLabels[opt]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onDelete={onDelete}
              mergeMode={mergeMode}
              isSelectedForMerge={selectedForMerge.includes(report.id)}
              isMergeDisabled={getMergeDisabled(report)}
              onToggleMerge={onToggleMerge}
            />
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <DataTable
          columns={tableColumns}
          data={sorted}
          sortable
          pagination
          pageSize={20}
          emptyMessage="No reports found"
          rowKey={(r) => r.id}
        />
      )}
    </div>
  );
}
