'use client';

import { useState, useMemo } from 'react';
import { formatDateTime } from '../../lib/format-datetime';
import { useSettings } from '../../lib/settings-context';
import { LiveTrade, DisplayMode } from '../../lib/live-types';
import { calculateRunningBalance, formatValue } from '../../lib/trade-stats';
import DataTable, { Column } from '../shared/DataTable';
import StatusBadge from '../shared/StatusBadge';

interface TradesTabProps {
  trades: LiveTrade[];
  balance: number;
  displayMode: DisplayMode;
}

type FilterType = 'all' | 'profit' | 'loss';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

export default function TradesTab({ trades, balance, displayMode }: TradesTabProps) {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const { timezone } = useSettings();

  const startingCapital = useMemo(() => {
    const totalPnl = trades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    return balance - totalPnl;
  }, [trades, balance]);

  const withBalance = useMemo(() => calculateRunningBalance(trades, startingCapital), [trades, startingCapital]);

  const filtered = useMemo(() => {
    if (filterType === 'profit') return withBalance.filter(r => (r.trade.profit + r.trade.commission + r.trade.swap) > 0);
    if (filterType === 'loss') return withBalance.filter(r => (r.trade.profit + r.trade.commission + r.trade.swap) < 0);
    return withBalance;
  }, [withBalance, filterType]);

  const displayData = useMemo(() => [...filtered].reverse(), [filtered]);

  const counts = useMemo(() => ({
    all: withBalance.length,
    profit: withBalance.filter(r => (r.trade.profit + r.trade.commission + r.trade.swap) > 0).length,
    loss: withBalance.filter(r => (r.trade.profit + r.trade.commission + r.trade.swap) < 0).length,
  }), [withBalance]);

  const columns: Column<{ trade: LiveTrade; balance: number }>[] = [
    {
      key: 'open_time', label: 'Open Time',
      render: (row) => <span className="text-text-muted text-xs">{formatDateTime(row.trade.open_time, timezone)}</span>,
      sortable: true, sortValue: (row) => row.trade.open_time,
    },
    {
      key: 'close_time', label: 'Close Time',
      render: (row) => <span className="text-text-muted text-xs">{formatDateTime(row.trade.close_time, timezone)}</span>,
      sortable: true, sortValue: (row) => row.trade.close_time,
    },
    {
      key: 'symbol', label: 'Symbol',
      render: (row) => <span className="text-text-primary font-medium font-mono">{row.trade.symbol}</span>,
      sortable: true, sortValue: (row) => row.trade.symbol,
    },
    {
      key: 'type', label: 'Type',
      render: (row) => <StatusBadge label={row.trade.type.toUpperCase()} variant={row.trade.type} />,
      sortable: true, sortValue: (row) => row.trade.type,
    },
    {
      key: 'volume', label: 'Volume', align: 'right',
      render: (row) => <span className="text-text-secondary">{row.trade.volume.toFixed(2)}</span>,
      sortable: true, sortValue: (row) => row.trade.volume,
    },
    {
      key: 'open_price', label: 'Open Price', align: 'right',
      render: (row) => <span className="text-text-secondary">{row.trade.open_price.toFixed(5)}</span>,
    },
    {
      key: 'close_price', label: 'Close Price', align: 'right',
      render: (row) => <span className="text-text-secondary">{row.trade.close_price.toFixed(5)}</span>,
    },
    {
      key: 'profit', label: 'Profit', align: 'right',
      render: (row) => {
        const net = row.trade.profit + row.trade.commission + row.trade.swap;
        const display = formatValue(net, displayMode, { startingCapital });
        return <span className={`font-semibold ${net >= 0 ? 'text-profit' : 'text-loss'}`}>{display}</span>;
      },
      sortable: true, sortValue: (row) => row.trade.profit + row.trade.commission + row.trade.swap,
    },
    {
      key: 'balance', label: 'Balance', align: 'right',
      render: (row) => <span className="text-text-primary font-mono">{formatCurrency(row.balance)}</span>,
      sortable: true, sortValue: (row) => row.balance,
    },
  ];

  if (trades.length === 0) {
    return <div className="py-16 text-center text-text-muted text-sm">No trades yet</div>;
  }

  return (
    <div className="space-y-0 pt-6">
      <div className="bg-bg-secondary border border-border border-b-0 rounded-t-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(['all', 'profit', 'loss'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 text-xs uppercase font-medium transition-colors ${
                  filterType === type
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <span className="text-xs text-text-muted font-mono">{counts[filterType]} trades</span>
        </div>
        <div className="bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-center">
          <p className="text-2xl font-bold text-text-primary font-mono">{counts.all}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Trade Count</p>
        </div>
      </div>

      <div className="[&>div]:rounded-t-none [&>div]:border-t-0">
        <DataTable
          columns={columns}
          data={displayData}
          sortable={true}
          pagination={true}
          pageSize={25}
          emptyMessage="No trades match this filter"
          rowKey={(row) => String(row.trade.ticket)}
        />
      </div>
    </div>
  );
}
