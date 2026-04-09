'use client';

import { formatDistanceToNow, parseISO } from 'date-fns';
import { LivePosition } from '../../lib/live-types';
import DataTable, { Column } from '../shared/DataTable';
import StatusBadge from '../shared/StatusBadge';

interface OpenPositionsTableProps {
  positions: LivePosition[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getPipMultiplier(symbol: string): number {
  // JPY pairs use 2/3 decimal places, so 1 pip = 0.01
  const isJpy = symbol.toUpperCase().includes('JPY');
  return isJpy ? 100 : 10000;
}

function calcPips(priceA: number, priceB: number, symbol: string): number {
  const multiplier = getPipMultiplier(symbol);
  return Math.abs(priceB - priceA) * multiplier;
}

function timeAgo(isoString: string): string {
  try {
    return formatDistanceToNow(parseISO(isoString), { addSuffix: true });
  } catch {
    return isoString;
  }
}

const columns: Column<LivePosition>[] = [
  {
    key: 'symbol',
    label: 'Symbol',
    render: (row) => (
      <span className="text-text-primary font-medium font-mono">{row.symbol}</span>
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
    label: 'Open Price',
    align: 'right',
    render: (row) => {
      const decimals = row.symbol.toUpperCase().includes('JPY') ? 3 : 5;
      return <span className="text-text-secondary">{row.open_price.toFixed(decimals)}</span>;
    },
  },
  {
    key: 'current_price',
    label: 'Current',
    align: 'right',
    render: (row) => {
      const decimals = row.symbol.toUpperCase().includes('JPY') ? 3 : 5;
      return <span className="text-text-primary">{row.current_price.toFixed(decimals)}</span>;
    },
  },
  {
    key: 'sl_tp',
    label: 'SL / TP',
    align: 'center',
    render: (row) => {
      const isJpy = row.symbol.toUpperCase().includes('JPY');
      const decimals = isJpy ? 3 : 5;
      const slPips = row.sl ? calcPips(row.open_price, row.sl, row.symbol) : null;
      const tpPips = row.tp ? calcPips(row.open_price, row.tp, row.symbol) : null;
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs">
            <span className="text-loss">{row.sl ? row.sl.toFixed(decimals) : '—'}</span>
            <span className="text-text-muted mx-1">/</span>
            <span className="text-profit">{row.tp ? row.tp.toFixed(decimals) : '—'}</span>
          </span>
          <span className="text-[10px]">
            <span className="text-loss">{slPips !== null ? `${slPips.toFixed(1)} pips` : '—'}</span>
            <span className="text-text-muted mx-1">/</span>
            <span className="text-profit">{tpPips !== null ? `${tpPips.toFixed(1)} pips` : '—'}</span>
          </span>
        </div>
      );
    },
  },
  {
    key: 'pips_away',
    label: 'Pips Away',
    align: 'center',
    render: (row) => {
      const slPips = row.sl ? calcPips(row.current_price, row.sl, row.symbol) : null;
      const tpPips = row.tp ? calcPips(row.current_price, row.tp, row.symbol) : null;
      return (
        <div className="flex flex-col items-center gap-0.5 text-xs">
          {slPips !== null ? (
            <span className="text-loss">{slPips.toFixed(1)} to SL</span>
          ) : (
            <span className="text-text-muted">—</span>
          )}
          {tpPips !== null ? (
            <span className="text-profit">{tpPips.toFixed(1)} to TP</span>
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </div>
      );
    },
  },
  {
    key: 'profit',
    label: 'P/L',
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
    key: 'open_time',
    label: 'Opened',
    render: (row) => (
      <span className="text-text-muted text-xs">{timeAgo(row.open_time)}</span>
    ),
    sortable: true,
    sortValue: (row) => row.open_time,
  },
];

export default function OpenPositionsTable({ positions }: OpenPositionsTableProps) {
  const totalFloating = positions.reduce((sum, p) => sum + p.profit, 0);

  return (
    <div className="space-y-0">
      <div className="bg-bg-secondary border border-border border-b-0 rounded-t-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Open Positions</h3>
          <span className="text-xs bg-bg-tertiary text-text-muted border border-border px-2 py-0.5 rounded font-mono">
            {positions.length}
          </span>
        </div>
        <span className={`text-sm font-semibold font-mono ${totalFloating >= 0 ? 'text-profit' : 'text-loss'}`}>
          {totalFloating >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(totalFloating)} floating
        </span>
      </div>
      <div className="[&>div]:rounded-t-none [&>div]:border-t-0">
        <DataTable
          columns={columns}
          data={positions}
          pagination={false}
          sortable={true}
          emptyMessage="No open positions"
          rowKey={(row) => String(row.ticket)}
        />
      </div>
    </div>
  );
}
