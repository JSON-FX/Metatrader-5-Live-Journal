'use client';

import { useState, useMemo } from 'react';
import { MT5Report, MT5Deal } from '../../lib/types';
import DataTable, { Column } from '../shared/DataTable';
import StatusBadge from '../shared/StatusBadge';

interface ReportTradesProps {
  report: MT5Report;
}

interface Trade {
  openTime: string;
  closeTime: string;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  commission: number;
  swap: number;
  balance: number;
}

type FilterType = 'all' | 'profit' | 'loss';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function groupDealsIntoTrades(deals: MT5Deal[]): Trade[] {
  const trades: Trade[] = [];
  const openPositions: Map<string, MT5Deal> = new Map();

  for (const deal of deals) {
    if (deal.type === 'balance' || !deal.symbol) continue;

    const key = `${deal.symbol}-${deal.order}`;

    if (deal.direction === 'in') {
      openPositions.set(key, deal);
    } else if (deal.direction === 'out') {
      const openDeal = openPositions.get(key);
      if (openDeal) {
        trades.push({
          openTime: openDeal.time,
          closeTime: deal.time,
          symbol: deal.symbol,
          type: openDeal.type,
          volume: deal.volume,
          openPrice: openDeal.price,
          closePrice: deal.price,
          profit: deal.profit,
          commission: (openDeal.commission || 0) + (deal.commission || 0),
          swap: deal.swap,
          balance: deal.balance,
        });
        openPositions.delete(key);
      } else {
        trades.push({
          openTime: deal.time,
          closeTime: deal.time,
          symbol: deal.symbol,
          type: deal.type,
          volume: deal.volume,
          openPrice: deal.price,
          closePrice: deal.price,
          profit: deal.profit,
          commission: deal.commission,
          swap: deal.swap,
          balance: deal.balance,
        });
      }
    }
  }

  return trades;
}

function TradeCountMiniChart({ deals }: { deals: MT5Deal[] }) {
  const { tradeCount, paths } = useMemo(() => {
    const closingDeals = deals.filter(d => d.direction === 'out' && d.symbol);
    const dailyCounts: Record<string, number> = {};
    closingDeals.forEach(deal => {
      const rawDate = deal.time.split(' ')[0];
      const date = rawDate.replace(/[\/\.]/g, '-');
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    const sortedDates = Object.keys(dailyCounts).sort();
    const chartData = sortedDates.map(date => ({ date, count: dailyCounts[date] }));
    const maxCount = Math.max(...chartData.map(d => d.count), 1);

    let generatedPaths: { linePath: string; areaPath: string } | null = null;
    if (chartData.length > 0) {
      const width = 280;
      const height = 40;
      const padding = 2;
      const xStep = chartData.length > 1 ? (width - padding * 2) / (chartData.length - 1) : 0;

      const points = chartData.map((d, i) => ({
        x: padding + i * xStep,
        y: height - padding - ((d.count / maxCount) * (height - padding * 2)),
      }));

      const linePath = points.map((p, i) =>
        i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
      ).join(' ');

      const areaPath = `${linePath} L ${points[points.length - 1]?.x || padding} ${height - padding} L ${padding} ${height - padding} Z`;
      generatedPaths = { linePath, areaPath };
    }

    return { tradeCount: closingDeals.length, paths: generatedPaths };
  }, [deals]);

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="text-3xl font-bold font-mono text-text-primary">{tradeCount}</div>
      <div className="text-[11px] text-text-muted uppercase tracking-[1px] mt-0.5">Trade Count</div>
      {paths && (
        <svg width="100%" height="40" viewBox="0 0 280 40" preserveAspectRatio="none" className="mt-3">
          <defs>
            <linearGradient id="tradeCountGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d={paths.areaPath} fill="url(#tradeCountGrad)" />
          <path d={paths.linePath} fill="none" stroke="var(--accent)" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
}

export default function ReportTrades({ report }: ReportTradesProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const allTrades = useMemo(() => groupDealsIntoTrades(report.deals), [report.deals]);

  const trades = useMemo(() => {
    if (filter === 'profit') return allTrades.filter(t => t.profit > 0);
    if (filter === 'loss') return allTrades.filter(t => t.profit < 0);
    return allTrades;
  }, [allTrades, filter]);

  const columns: Column<Trade>[] = [
    {
      key: 'closeTime',
      label: 'Time',
      sortable: true,
      sortValue: (t) => t.closeTime,
      render: (t) => (
        <span className="text-text-secondary">{t.closeTime.replace(/\./g, '/')}</span>
      ),
    },
    {
      key: 'symbol',
      label: 'Symbol',
      render: (t) => (
        <span className="text-text-primary font-medium">{t.symbol.replace('_tickstory', '')}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (t) => (
        <StatusBadge
          label={t.type.toUpperCase()}
          variant={t.type.toLowerCase() === 'buy' ? 'buy' : 'sell'}
        />
      ),
    },
    {
      key: 'volume',
      label: 'Volume',
      align: 'right',
      sortable: true,
      sortValue: (t) => t.volume,
      render: (t) => <span className="text-text-secondary">{t.volume.toFixed(2)}</span>,
    },
    {
      key: 'openPrice',
      label: 'Open Price',
      align: 'right',
      render: (t) => <span className="text-text-secondary">{t.openPrice.toFixed(5)}</span>,
    },
    {
      key: 'closePrice',
      label: 'Close Price',
      align: 'right',
      render: (t) => <span className="text-text-secondary">{t.closePrice.toFixed(5)}</span>,
    },
    {
      key: 'profit',
      label: 'Profit',
      align: 'right',
      sortable: true,
      sortValue: (t) => t.profit,
      render: (t) => (
        <span className={t.profit >= 0 ? 'text-profit' : 'text-loss'}>
          {formatCurrency(t.profit)}
        </span>
      ),
    },
    {
      key: 'balance',
      label: 'Balance',
      align: 'right',
      sortable: true,
      sortValue: (t) => t.balance,
      render: (t) => <span className="text-text-secondary">{formatCurrency(t.balance)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top row: filter + mini chart */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Filter buttons */}
        <div className="flex items-center gap-1">
          {(['all', 'profit', 'loss'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium uppercase tracking-[1px] rounded transition-colors border ${
                filter === f
                  ? 'bg-bg-tertiary border-border text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {f}
            </button>
          ))}
          <span className="text-xs text-text-muted ml-2">{trades.length} trades</span>
        </div>

        {/* Mini chart */}
        <div className="w-72 shrink-0">
          <TradeCountMiniChart deals={report.deals} />
        </div>
      </div>

      {/* Trades table */}
      <DataTable
        columns={columns}
        data={trades}
        rowKey={(t, i) => `${t.closeTime}-${i}`}
        emptyMessage="No trades found"
      />
    </div>
  );
}
