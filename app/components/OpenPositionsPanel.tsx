'use client';

import { formatDistanceToNow, parseISO } from 'date-fns';
import { LivePosition } from '../lib/live-types';

interface OpenPositionsPanelProps {
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

function timeAgo(isoString: string): string {
  try {
    return formatDistanceToNow(parseISO(isoString), { addSuffix: true });
  } catch {
    return isoString;
  }
}

export default function OpenPositionsPanel({ positions }: OpenPositionsPanelProps) {
  if (positions.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <h2 className="text-base font-semibold text-white mb-4">Open Positions</h2>
        <p className="text-sm text-zinc-500">No open positions</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Open Positions</h2>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">
          {positions.length} open
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Symbol</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Type</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Volume</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Open</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Current</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">SL / TP</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide text-right">P/L</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Opened</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {positions.map((pos) => {
              const isBuy = pos.type === 'buy';
              const isProfit = pos.profit >= 0;
              return (
                <tr key={pos.ticket} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-white">{pos.symbol}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      isBuy
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {pos.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-zinc-300">{pos.volume.toFixed(2)}</td>
                  <td className="px-6 py-3 text-zinc-300">{pos.open_price.toFixed(5)}</td>
                  <td className="px-6 py-3 text-zinc-300">{pos.current_price.toFixed(5)}</td>
                  <td className="px-6 py-3 text-zinc-500 text-xs">
                    <span className="text-red-400">{pos.sl ? pos.sl.toFixed(5) : '—'}</span>
                    {' / '}
                    <span className="text-emerald-400">{pos.tp ? pos.tp.toFixed(5) : '—'}</span>
                  </td>
                  <td className={`px-6 py-3 text-right font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(pos.profit)}
                  </td>
                  <td className="px-6 py-3 text-zinc-500 text-xs whitespace-nowrap">
                    {timeAgo(pos.open_time)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
