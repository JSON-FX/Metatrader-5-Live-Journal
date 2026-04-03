'use client';

import { useState, useMemo } from 'react';
import { RawDeal, RawOrder, DisplayMode } from '../../lib/live-types';
import { formatValue } from '../../lib/trade-stats';
import { formatDateTime } from '../../lib/format-datetime';
import { useSettings } from '../../lib/settings-context';
import DataTable, { Column } from '../shared/DataTable';

interface OrdersDealsTabProps {
  rawDeals: RawDeal[];
  rawOrders: RawOrder[];
  balance: number;
  displayMode: DisplayMode;
}

type FilterKind = 'all' | 'deals' | 'orders';

type ActivityRow =
  | { kind: 'deal'; time: string; data: RawDeal }
  | { kind: 'order'; time: string; data: RawOrder };

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

export default function OrdersDealsTab({ rawDeals, rawOrders, balance, displayMode }: OrdersDealsTabProps) {
  const [filterKind, setFilterKind] = useState<FilterKind>('all');
  const [filterSymbol, setFilterSymbol] = useState<string>('all');
  const { timezone } = useSettings();

  const startingCapital = useMemo(() => {
    const totalPnl = rawDeals
      .filter(d => d.entry === 'out')
      .reduce((sum, d) => sum + d.profit + d.commission + d.swap, 0);
    return balance - totalPnl;
  }, [rawDeals, balance]);

  // Merge deals and orders into a single chronological list
  const merged = useMemo(() => {
    const items: ActivityRow[] = [];

    for (const deal of rawDeals) {
      items.push({ kind: 'deal', time: deal.time, data: deal });
    }
    for (const order of rawOrders) {
      items.push({ kind: 'order', time: order.time_setup, data: order });
    }

    items.sort((a, b) => b.time.localeCompare(a.time)); // newest first
    return items;
  }, [rawDeals, rawOrders]);

  // Available symbols for filter
  const symbols = useMemo(() => {
    const set = new Set<string>();
    for (const item of merged) {
      const sym = item.kind === 'deal' ? item.data.symbol : item.data.symbol;
      if (sym) set.add(sym);
    }
    return Array.from(set).sort();
  }, [merged]);

  // Apply filters
  const filtered = useMemo(() => {
    let items = merged;
    if (filterKind === 'deals') items = items.filter(i => i.kind === 'deal');
    if (filterKind === 'orders') items = items.filter(i => i.kind === 'order');
    if (filterSymbol !== 'all') {
      items = items.filter(i => {
        const sym = i.kind === 'deal' ? i.data.symbol : i.data.symbol;
        return sym === filterSymbol;
      });
    }
    return items;
  }, [merged, filterKind, filterSymbol]);

  const columns: Column<ActivityRow>[] = [
    {
      key: 'time', label: 'Time',
      render: (row) => (
        <span className="text-text-muted text-xs">{formatDateTime(row.time, timezone)}</span>
      ),
      sortable: true, sortValue: (row) => row.time,
    },
    {
      key: 'kind', label: 'Kind',
      render: (row) => (
        row.kind === 'deal'
          ? <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-accent/15 text-accent">DEAL</span>
          : <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400">ORDER</span>
      ),
      sortable: true, sortValue: (row) => row.kind,
    },
    {
      key: 'symbol', label: 'Symbol',
      render: (row) => {
        const sym = row.kind === 'deal' ? row.data.symbol : row.data.symbol;
        return sym
          ? <span className="text-text-primary font-medium font-mono">{sym}</span>
          : <span className="text-text-muted">—</span>;
      },
      sortable: true, sortValue: (row) => row.kind === 'deal' ? row.data.symbol : row.data.symbol,
    },
    {
      key: 'type', label: 'Type',
      render: (row) => {
        if (row.kind === 'deal') {
          const deal = row.data as RawDeal;
          const isNonTrading = !['buy', 'sell'].includes(deal.type);
          if (isNonTrading) {
            return <span className="px-2 py-0.5 rounded text-[11px] bg-warning/15 text-warning">{deal.type.toUpperCase()}</span>;
          }
          return (
            <span className={`px-2 py-0.5 rounded text-[11px] ${
              deal.type === 'buy' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
            }`}>
              {deal.type.toUpperCase()}
            </span>
          );
        }
        const order = row.data as RawOrder;
        const isBuy = order.type.startsWith('buy');
        return (
          <span className={`px-2 py-0.5 rounded text-[11px] ${
            isBuy ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
          }`}>
            {order.type.toUpperCase().replace('_', ' ')}
          </span>
        );
      },
      sortable: true,
      sortValue: (row) => row.kind === 'deal' ? (row.data as RawDeal).type : (row.data as RawOrder).type,
    },
    {
      key: 'entry', label: 'Entry',
      render: (row) => {
        if (row.kind === 'deal') {
          const deal = row.data as RawDeal;
          const colorMap: Record<string, string> = {
            'in': 'text-[#60a5fa]',
            'out': 'text-loss',
            'reverse': 'text-warning',
          };
          return <span className={`text-xs font-medium ${colorMap[deal.entry] ?? 'text-text-muted'}`}>
            {deal.entry ? deal.entry.toUpperCase() : '—'}
          </span>;
        }
        const order = row.data as RawOrder;
        const colorMap: Record<string, string> = {
          'filled': 'text-profit',
          'canceled': 'text-warning',
          'expired': 'text-text-muted',
          'rejected': 'text-text-muted',
          'placed': 'text-[#60a5fa]',
        };
        return <span className={`text-xs font-medium ${colorMap[order.state] ?? 'text-text-muted'}`}>
          {order.state.toUpperCase()}
        </span>;
      },
      sortable: true,
      sortValue: (row) => row.kind === 'deal' ? (row.data as RawDeal).entry : (row.data as RawOrder).state,
    },
    {
      key: 'volume', label: 'Volume', align: 'right',
      render: (row) => {
        const vol = row.kind === 'deal'
          ? (row.data as RawDeal).volume
          : (row.data as RawOrder).volume_initial;
        return vol > 0
          ? <span className="text-text-secondary">{vol.toFixed(2)}</span>
          : <span className="text-text-muted">—</span>;
      },
      sortable: true,
      sortValue: (row) => row.kind === 'deal' ? (row.data as RawDeal).volume : (row.data as RawOrder).volume_initial,
    },
    {
      key: 'price', label: 'Price', align: 'right',
      render: (row) => {
        const price = row.kind === 'deal'
          ? (row.data as RawDeal).price
          : (row.data as RawOrder).price;
        return price > 0
          ? <span className="text-text-secondary">{price.toFixed(5)}</span>
          : <span className="text-text-muted">—</span>;
      },
    },
    {
      key: 'profit', label: 'Profit', align: 'right',
      render: (row) => {
        if (row.kind === 'order') return <span className="text-text-muted">—</span>;
        const deal = row.data as RawDeal;
        // Show profit for exit deals and balance operations
        if (deal.entry === 'in') return <span className="text-text-muted">—</span>;
        const val = deal.profit;
        if (val === 0 && deal.entry === '') {
          // Non-trading deal with profit (e.g., balance deposit)
          return <span className="text-profit">{formatCurrency(deal.profit)}</span>;
        }
        return <span className={`font-semibold ${val >= 0 ? 'text-profit' : 'text-loss'}`}>
          {formatCurrency(val)}
        </span>;
      },
      sortable: true,
      sortValue: (row) => row.kind === 'deal' ? (row.data as RawDeal).profit : 0,
    },
    {
      key: 'comment', label: 'Comment',
      render: (row) => {
        if (row.kind === 'order') {
          const order = row.data as RawOrder;
          const parts: string[] = [];
          if (order.sl) parts.push(`SL: ${order.sl.toFixed(5)}`);
          if (order.tp) parts.push(`TP: ${order.tp.toFixed(5)}`);
          if (order.comment) parts.push(order.comment);
          return <span className="text-text-muted text-xs">{parts.join(' ')}</span>;
        }
        const deal = row.data as RawDeal;
        return <span className="text-text-muted text-xs">{deal.comment}</span>;
      },
    },
  ];

  if (rawDeals.length === 0 && rawOrders.length === 0) {
    return <div className="py-16 text-center text-text-muted text-sm">No orders or deals yet</div>;
  }

  return (
    <div className="space-y-0 pt-6">
      <div className="bg-bg-secondary border border-border border-b-0 rounded-t-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(['all', 'deals', 'orders'] as const).map(kind => (
              <button
                key={kind}
                onClick={() => setFilterKind(kind)}
                className={`px-3 py-1.5 text-xs uppercase font-medium transition-colors ${
                  filterKind === kind
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
                }`}
              >
                {kind}
              </button>
            ))}
          </div>
          <span className="text-xs text-text-muted font-mono">{filtered.length} items</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="text-xs bg-bg-tertiary border border-border rounded-lg px-3 py-1.5 text-text-secondary"
          >
            <option value="all">Symbol: All</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="[&>div]:rounded-t-none [&>div]:border-t-0">
        <DataTable
          columns={columns}
          data={filtered}
          sortable={true}
          pagination={true}
          pageSize={25}
          emptyMessage="No items match this filter"
          rowKey={(row) => `${row.kind}-${row.kind === 'deal' ? (row.data as RawDeal).ticket : (row.data as RawOrder).ticket}`}
        />
      </div>
    </div>
  );
}
