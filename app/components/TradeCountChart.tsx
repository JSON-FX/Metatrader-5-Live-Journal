'use client';

import { useMemo } from 'react';
import { MT5Deal } from '../lib/types';

interface TradeCountChartProps {
  deals: MT5Deal[];
  dateRange?: 'all' | '1m' | '3m' | '6m' | '1y';
}

export default function TradeCountChart({ deals, dateRange = 'all' }: TradeCountChartProps) {
  const { tradeCount, chartData, maxCount } = useMemo(() => {
    // Filter to only closing deals (out direction with profit/loss)
    const closingDeals = deals.filter(d => d.direction === 'out' && d.symbol);

    // Group by date
    const dailyCounts: Record<string, number> = {};
    closingDeals.forEach(deal => {
      // Normalize date format (handle YYYY/MM/DD, YYYY.MM.DD, and YYYY-MM-DD)
      const rawDate = deal.time.split(' ')[0];
      const date = rawDate.replace(/[\/\.]/g, '-');
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    // Sort dates and create chart data
    const sortedDates = Object.keys(dailyCounts).sort();
    const data = sortedDates.map(date => ({
      date,
      count: dailyCounts[date]
    }));

    const max = Math.max(...data.map(d => d.count), 1);

    return {
      tradeCount: closingDeals.length,
      chartData: data,
      maxCount: max
    };
  }, [deals]);

  // Generate SVG path for area chart
  const generatePath = (): { linePath: string; areaPath: string } | null => {
    if (chartData.length === 0) return null;

    const width = 280;
    const height = 40;
    const padding = 2;

    const xStep = chartData.length > 1 ? (width - padding * 2) / (chartData.length - 1) : 0;

    const points = chartData.map((d, i) => {
      const x = padding + i * xStep;
      const y = height - padding - ((d.count / maxCount) * (height - padding * 2));
      return { x, y };
    });

    // Line path
    const linePath = points.map((p, i) =>
      i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
    ).join(' ');

    // Area path (close to bottom)
    const areaPath = `${linePath} L ${points[points.length - 1]?.x || padding} ${height - padding} L ${padding} ${height - padding} Z`;

    return { linePath, areaPath };
  };

  const paths = generatePath();

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-3xl font-bold text-white">{tradeCount}</div>
          <div className="text-xs text-zinc-500">Trade Count</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>Range:</span>
          <span className="text-zinc-400">{dateRange === 'all' ? 'All' : dateRange.toUpperCase()}</span>
        </div>
      </div>

      {paths && (
        <svg width="100%" height="40" viewBox="0 0 280 40" preserveAspectRatio="none" className="mt-2">
          <defs>
            <linearGradient id="tradeCountGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d={paths.areaPath} fill="url(#tradeCountGradient)" />
          <path d={paths.linePath} fill="none" stroke="#3b82f6" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
}
