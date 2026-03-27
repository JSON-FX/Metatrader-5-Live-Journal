'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { LiveTrade } from '../lib/live-types';

interface LiveTradesTableProps {
  trades: LiveTrade[];
  historyDays: number;
  onChangeDays: (days: number) => void;
}

type SortField = 'close_time' | 'profit' | 'volume' | 'type';
type SortDirection = 'asc' | 'desc';
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
  const [sortField, setSortField]     = useState<SortField>('close_time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType]   = useState<FilterType>('all');
  const [showAll, setShowAll]         = useState(false);

  const sorted = useMemo(() => {
    let list = trades;
    if (filterType === 'profit') list = trades.filter(t => t.profit > 0);
    if (filterType === 'loss')   list = trades.filter(t => t.profit < 0);

    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'close_time': cmp = a.close_time.localeCompare(b.close_time); break;
        case 'profit':     cmp = a.profit - b.profit; break;
        case 'volume':     cmp = a.volume - b.volume; break;
        case 'type':       cmp = a.type.localeCompare(b.type); break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [trades, sortField, sortDirection, filterType]);

  const displayed = showAll ? sorted : sorted.slice(0, 20);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-zinc-500" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-500" />
      : <ChevronDown className="w-3 h-3 text-blue-500" />;
  };

  const totalProfit = trades.reduce((s, t) => s + t.profit, 0);
  const winRate = trades.length > 0
    ? Math.round((trades.filter(t => t.profit > 0).length / trades.length) * 100)
    : 0;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Live Trade History</h3>
          <p className="text-sm text-zinc-400 mt-1">
            {sorted.length} trades · Win rate {winRate}% ·{' '}
            <span className={totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {formatCurrency(totalProfit)} net
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Days selector */}
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {DAY_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => onChangeDays(d)}
                className={`px-2.5 py-1.5 text-xs transition-colors ${
                  historyDays === d
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Win/Loss filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-500" />
            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
              {(['all', 'profit', 'loss'] as const).map(type => (
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
      </div>

      {trades.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 text-sm">
          No closed trades in the last {historyDays} days
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    <button onClick={() => handleSort('close_time')} className="flex items-center gap-1 hover:text-white transition-colors">
                      Close Time <SortIcon field="close_time" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    <button onClick={() => handleSort('type')} className="flex items-center gap-1 hover:text-white transition-colors">
                      Type <SortIcon field="type" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    <button onClick={() => handleSort('volume')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                      Volume <SortIcon field="volume" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Open</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Close</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    <button onClick={() => handleSort('profit')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                      Profit <SortIcon field="profit" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Comm+Swap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {displayed.map((trade, i) => (
                  <tr key={`${trade.ticket}-${i}`} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-zinc-300 whitespace-nowrap">{formatDate(trade.close_time)}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium whitespace-nowrap">{trade.symbol}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        trade.type === 'buy'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300 text-right whitespace-nowrap">{trade.volume.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300 text-right whitespace-nowrap">{trade.open_price.toFixed(5)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300 text-right whitespace-nowrap">{trade.close_price.toFixed(5)}</td>
                    <td className={`px-4 py-3 text-sm font-medium text-right whitespace-nowrap ${
                      trade.profit >= 0 ? 'text-emerald-500' : 'text-red-500'
                    }`}>
                      {formatCurrency(trade.profit)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500 text-right whitespace-nowrap">
                      {formatCurrency(trade.commission + trade.swap)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sorted.length > 20 && (
            <div className="p-4 border-t border-zinc-800 text-center">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                {showAll ? 'Show Less' : `Show All (${sorted.length - 20} more)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
