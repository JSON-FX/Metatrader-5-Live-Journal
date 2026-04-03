'use client';

import { useMemo } from 'react';
import { LiveTrade, DisplayMode } from '../../lib/live-types';
import { groupByMonth, MonthlyPnl, formatValue } from '../../lib/trade-stats';
import { useSettings } from '../../lib/settings-context';

interface PerformanceTabProps {
  trades: LiveTrade[];
  balance: number;
  displayMode: DisplayMode;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PerformanceTab({ trades, balance, displayMode }: PerformanceTabProps) {
  const { timezone } = useSettings();

  const startingCapital = useMemo(() => {
    const totalPnl = trades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    return balance - totalPnl;
  }, [trades, balance]);

  const monthly = useMemo(() => groupByMonth(trades, timezone), [trades, timezone]);

  const grid = useMemo(() => {
    const yearMap = new Map<number, (MonthlyPnl | null)[]>();

    for (const m of monthly) {
      if (!yearMap.has(m.year)) {
        yearMap.set(m.year, Array(12).fill(null));
      }
      yearMap.get(m.year)![m.month] = m;
    }

    return Array.from(yearMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, months]) => {
        const total = months.reduce((sum, m) => sum + (m?.pnl ?? 0), 0);
        return { year, months, total };
      });
  }, [monthly]);

  if (trades.length === 0) {
    return <div className="py-16 text-center text-text-muted text-sm">No trades yet</div>;
  }

  return (
    <div className="pt-6">
      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[10px] text-text-muted uppercase tracking-wider font-medium px-3 py-2.5">Year</th>
              {MONTH_LABELS.map(m => (
                <th key={m} className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium px-1.5 py-2.5">{m}</th>
              ))}
              <th className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium px-3 py-2.5">Total</th>
            </tr>
          </thead>
          <tbody>
            {grid.map(({ year, months, total }) => (
              <tr key={year} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2.5 text-sm font-semibold text-text-primary">{year}</td>
                {months.map((m, i) => (
                  <td key={i} className="px-1.5 py-2.5 text-center">
                    {m ? (
                      <span className={`text-xs font-mono font-medium ${m.pnl >= 0 ? 'text-accent' : 'text-loss'}`}>
                        {formatValue(m.pnl, displayMode, { startingCapital })}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs font-mono font-semibold ${total >= 0 ? 'text-accent' : 'text-loss'}`}>
                    {formatValue(total, displayMode, { startingCapital })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
