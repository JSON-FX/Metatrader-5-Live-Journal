'use client';

import Link from 'next/link';
import { Trash2, CheckSquare, Square } from 'lucide-react';
import { useState } from 'react';
import { MT5Report } from '../../lib/types';
import StatusBadge from '../shared/StatusBadge';
import Sparkline from '../shared/Sparkline';

interface ReportCardProps {
  report: MT5Report;
  onDelete: (id: string) => void;
  mergeMode?: boolean;
  isSelectedForMerge?: boolean;
  isMergeDisabled?: boolean;
  onToggleMerge?: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getDateRange(report: MT5Report): string {
  const closingDeals = report.deals.filter(d => d.direction === 'out' && d.time);
  if (closingDeals.length === 0) return '—';
  const first = closingDeals[0].time.split(' ')[0].replace(/\./g, '/');
  const last = closingDeals[closingDeals.length - 1].time.split(' ')[0].replace(/\./g, '/');
  if (first === last) return first;
  return `${first} – ${last}`;
}

export default function ReportCard({
  report,
  onDelete,
  mergeMode = false,
  isSelectedForMerge = false,
  isMergeDisabled = false,
  onToggleMerge,
}: ReportCardProps) {
  const [showDelete, setShowDelete] = useState(false);

  const symbol = report.settings.symbol.replace('_tickstory', '').toUpperCase();
  const equityData = report.deals.filter(d => d.balance > 0).map(d => d.balance);
  const netProfit = report.results.totalNetProfit;
  const profitFactor = report.results.profitFactor;
  const tradeCount = report.tradeStats.totalTrades;
  const dateRange = getDateRange(report);
  const isProfit = netProfit >= 0;

  const badgeVariant: 'backtest' | 'forward' | 'merged' =
    report.type === 'merged' ? 'merged' : report.type === 'forward' ? 'forward' : 'backtest';

  const cardClasses = `
    relative bg-bg-secondary border rounded-xl p-5 transition-all duration-150
    ${mergeMode
      ? isSelectedForMerge
        ? 'border-warning cursor-pointer'
        : isMergeDisabled
          ? 'border-border opacity-40 cursor-not-allowed'
          : 'border-border hover:border-warning/50 cursor-pointer'
      : 'border-border hover:border-accent/40'
    }
  `.trim();

  const cardContent = (
    <div
      className={cardClasses}
      onMouseEnter={() => !mergeMode && setShowDelete(true)}
      onMouseLeave={() => !mergeMode && setShowDelete(false)}
      onClick={mergeMode && !isMergeDisabled ? () => onToggleMerge?.(report.id) : undefined}
    >
      {/* Merge mode checkbox */}
      {mergeMode && (
        <div className="absolute top-3 right-3">
          {isSelectedForMerge ? (
            <CheckSquare className="w-5 h-5 text-warning" />
          ) : (
            <Square className={`w-5 h-5 ${isMergeDisabled ? 'text-text-muted' : 'text-text-muted hover:text-warning'}`} />
          )}
        </div>
      )}

      {/* Delete button (normal mode) */}
      {!mergeMode && showDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(report.id);
          }}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-text-muted hover:text-loss hover:bg-loss/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3 pr-8">
        <div>
          <h3 className="text-base font-semibold text-text-primary font-mono">{symbol}</h3>
          <p className="text-xs text-text-muted mt-0.5">{dateRange}</p>
        </div>
        <StatusBadge label={report.type.charAt(0).toUpperCase() + report.type.slice(1)} variant={badgeVariant} />
      </div>

      {/* Net Profit */}
      <div className="mb-3">
        <span className={`text-2xl font-bold font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
          {formatCurrency(netProfit)}
        </span>
        <span className="text-xs text-text-muted ml-2">net profit</span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-3 text-xs text-text-secondary">
        <span>
          <span className="text-text-muted">PF </span>
          <span className="font-mono">{profitFactor.toFixed(2)}</span>
        </span>
        <span>
          <span className="text-text-muted">Trades </span>
          <span className="font-mono">{tradeCount}</span>
        </span>
      </div>

      {/* Sparkline */}
      {equityData.length > 1 && (
        <div className="mt-3">
          <Sparkline
            data={equityData}
            color={isProfit ? 'var(--profit)' : 'var(--loss)'}
            height={36}
          />
        </div>
      )}
    </div>
  );

  if (mergeMode) {
    return cardContent;
  }

  return (
    <Link href={`/backtests/${report.id}`} className="block">
      {cardContent}
    </Link>
  );
}
