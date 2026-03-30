'use client';

import { useState, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { LiveTrade } from '../../lib/live-types';
import DataTable, { Column } from '../shared/DataTable';
import StatusBadge from '../shared/StatusBadge';

interface LiveTradesTableProps {
  trades: LiveTrade[];
  historyDays: number;
  onChangeDays: (days: number) => void;
}

type FilterType = 'all' | 'profit' | 'loss';

const DAY_OPTIONS = [7, 30, 90, 180, 365];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(isoString: string): string {
  try {
    return format(parseISO(isoString), 'yyyy-MM-dd HH:mm');
  } catch {
    return isoString;
  }
}

export default function LiveTradesTable({ trades, historyDays, onChangeDays }: LiveTradesTableProps) {
  const [filterType, setFilterType] = useState<FilterType>('all');

  const filtered = useMemo(() => {
    if (filterType === 'profit') return trades.filter(t => t.profit > 0);
    if (filterType === 'loss') return trades.filter(t => t.profit < 0);
    return trades;
  }, [trades, filterType]);

  const totalNet = useMemo(
    () => trades.reduce((s, t) => s + t.profit + t.commission + t.swap, 0),
    [trades]
  );

  const winRate = trades.length > 0
    ? Math.round((trades.filter(t => t.profit > 0).length / trades.length) * 100)
    : 0;

  const columns: Column<LiveTrade>[] = [
    {
      key: 'close_time',
      label: 'Close Time',
      render: (row) => (
        <span className="text-text-muted text-xs">{formatDate(row.close_time)}</span>
      ),
      sortable: true,
      sortValue: (row) => row.close_time,
    },
    {
      key: 'symbol',
      label: 'Symbol',
      render: (row) => (
        <span className="text-text-primary font-medium">{row.symbol}</span>
      ),
      sortable: true,
      sortValue: (row) => row.symbol,
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => (
        <StatusBadge label={row.type.toUpperCase()} variant={row.type} />
      ),
      sortable: true,
      sortValue: (row) => row.type,
    },
    {
      key: 'volume',
      label: 'Volume',
      align: 'right',
      render: (row) => (
        <span className="text-text-secondary">{row.volume.toFixed(2)}</span>
      ),
      sortable: true,
      sortValue: (row) => row.volume,
    },
    {
      key: 'open_price',
      label: 'Open',
      align: 'right',
      render: (row) => (
        <span className="text-text-secondary">{row.open_price.toFixed(5)}</span>
      ),
    },
    {
      key: 'close_price',
      label: 'Close',
      align: 'right',
      render: (row) => (
        <span className="text-text-secondary">{row.close_price.toFixed(5)}</span>
      ),
    },
    {
      key: 'profit',
      label: 'Profit',
      align: 'right',
      render: (row) => (
        <span className={`font-semibold ${row.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
          {formatCurrency(row.profit)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.profit,
    },
    {
      key: 'comm_swap',
      label: 'Comm+Swap',
      align: 'right',
      render: (row) => (
        <span className="text-text-muted">{formatCurrency(row.commission + row.swap)}</span>
      ),
      sortable: true,
      sortValue: (row) => row.commission + row.swap,
    },
  ];

  return (
    <div className="space-y-0">
      {/* Header panel */}
      <div className="bg-bg-secondary border border-border border-b-0 rounded-t-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Trade History</h3>
          <p className="text-xs text-text-muted mt-0.5 font-mono">
            {filtered.length} trades · Win rate {winRate}% ·{' '}
            <span className={totalNet >= 0 ? 'text-profit' : 'text-loss'}>
              {totalNet >= 0 ? '+' : ''}{formatCurrency(totalNet)} net
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Day selector */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            {DAY_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => onChangeDays(d)}
                className={`px-2.5 py-1.5 text-xs font-mono transition-colors ${
                  historyDays === d
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <div className="flex rounded-lg overflow-hidden border border-border">
              {(['all', 'profit', 'loss'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                    filterType === type
                      ? 'bg-bg-tertiary text-text-primary'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="[&>div]:rounded-t-none [&>div]:border-t-0">
        <DataTable
          columns={columns}
          data={filtered}
          sortable={true}
          pagination={true}
          pageSize={20}
          emptyMessage={`No closed trades in the last ${historyDays} days`}
          rowKey={(row, i) => `${row.ticket}-${i}`}
        />
      </div>
    </div>
  );
}
