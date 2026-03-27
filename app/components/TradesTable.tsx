'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown, Filter } from 'lucide-react';
import { MT5Report, MT5Deal } from '../lib/types';

interface TradesTableProps {
  report: MT5Report;
}

type SortField = 'time' | 'profit' | 'volume' | 'type';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'profit' | 'loss';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/\./g, '/');
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
          balance: deal.balance
        });
        openPositions.delete(key);
      } else {
        // Closing deal without matching open - still record it
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
          balance: deal.balance
        });
      }
    }
  }

  return trades;
}

export default function TradesTable({ report }: TradesTableProps) {
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showAll, setShowAll] = useState(false);

  const trades = useMemo(() => groupDealsIntoTrades(report.deals), [report.deals]);

  const sortedAndFilteredTrades = useMemo(() => {
    let filtered = trades;

    // Apply filter
    if (filterType === 'profit') {
      filtered = trades.filter(t => t.profit > 0);
    } else if (filterType === 'loss') {
      filtered = trades.filter(t => t.profit < 0);
    }

    // Apply sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'time':
          comparison = a.closeTime.localeCompare(b.closeTime);
          break;
        case 'profit':
          comparison = a.profit - b.profit;
          break;
        case 'volume':
          comparison = a.volume - b.volume;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [trades, sortField, sortDirection, filterType]);

  const displayedTrades = showAll ? sortedAndFilteredTrades : sortedAndFilteredTrades.slice(0, 20);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-500" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-500" />
      : <ChevronDown className="w-3 h-3 text-blue-500" />;
  };

  if (trades.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
        <p className="text-zinc-400">No trade data available</p>
        <p className="text-sm text-zinc-500 mt-2">The report may not contain deal information</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Trade History</h3>
          <p className="text-sm text-zinc-400 mt-1">
            {sortedAndFilteredTrades.length} trades
            {filterType !== 'all' && ` (${filterType})`}
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {(['all', 'profit', 'loss'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                  filterType === type
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('time')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  Time
                  <SortIcon field="time" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('type')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  Type
                  <SortIcon field="type" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('volume')}
                  className="flex items-center gap-1 hover:text-white transition-colors ml-auto"
                >
                  Volume
                  <SortIcon field="volume" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Open
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Close
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('profit')}
                  className="flex items-center gap-1 hover:text-white transition-colors ml-auto"
                >
                  Profit
                  <SortIcon field="profit" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {displayedTrades.map((trade, index) => (
              <tr
                key={`${trade.closeTime}-${index}`}
                className="hover:bg-zinc-800/50 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-zinc-300 whitespace-nowrap">
                  {formatDate(trade.closeTime)}
                </td>
                <td className="px-4 py-3 text-sm text-white font-medium whitespace-nowrap">
                  {trade.symbol.replace('_tickstory', '')}
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    trade.type.toLowerCase() === 'buy'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {trade.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-300 text-right whitespace-nowrap">
                  {trade.volume.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-300 text-right whitespace-nowrap">
                  {trade.openPrice.toFixed(5)}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-300 text-right whitespace-nowrap">
                  {trade.closePrice.toFixed(5)}
                </td>
                <td className={`px-4 py-3 text-sm font-medium text-right whitespace-nowrap ${
                  trade.profit >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {formatCurrency(trade.profit)}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-300 text-right whitespace-nowrap">
                  {formatCurrency(trade.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show More */}
      {sortedAndFilteredTrades.length > 20 && (
        <div className="p-4 border-t border-zinc-800 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showAll
              ? 'Show Less'
              : `Show All (${sortedAndFilteredTrades.length - 20} more)`
            }
          </button>
        </div>
      )}
    </div>
  );
}
