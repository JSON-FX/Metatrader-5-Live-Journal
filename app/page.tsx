'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, FileText, Loader2, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { loadReports } from './lib/storage';
import { LiveAccountInfo, LiveStatus } from './lib/live-types';
import ThemeToggle from './components/shared/ThemeToggle';
import Sparkline from './components/shared/Sparkline';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

function StatusDot({ status }: { status: LiveStatus }) {
  const colors: Record<LiveStatus, string> = {
    connecting: 'bg-warning',
    online: 'bg-profit',
    offline: 'bg-loss',
  };
  const labels: Record<LiveStatus, string> = {
    connecting: 'Connecting',
    online: 'Online',
    offline: 'Offline',
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />
      <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">{labels[status]}</span>
    </div>
  );
}

export default function Home() {
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('connecting');
  const [account, setAccount] = useState<LiveAccountInfo | null>(null);
  const [positionCount, setPositionCount] = useState(0);
  const [equityPoints, setEquityPoints] = useState<number[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const [bestProfit, setBestProfit] = useState<number | null>(null);
  const [profitBars, setProfitBars] = useState<number[]>([]);

  useEffect(() => {
    async function fetchLive() {
      try {
        const [healthRes, accountRes, positionsRes, historyRes] = await Promise.all([
          fetch('/api/live/health'),
          fetch('/api/live/account'),
          fetch('/api/live/positions'),
          fetch('/api/live/history?days=30'),
        ]);

        if (!healthRes.ok) {
          setLiveStatus('offline');
          return;
        }
        setLiveStatus('online');

        if (accountRes.ok) {
          const acc: LiveAccountInfo = await accountRes.json();
          setAccount(acc);
        }
        if (positionsRes.ok) {
          const pos = await positionsRes.json();
          setPositionCount(pos.length);
        }
        if (historyRes.ok) {
          const trades = await historyRes.json();
          if (trades.length > 0) {
            let running = 0;
            const points = trades.slice(-20).map((t: { profit: number }) => {
              running += t.profit;
              return running;
            });
            setEquityPoints(points);
          }
        }
      } catch {
        setLiveStatus('offline');
      }
    }

    const reports = loadReports();
    setReportCount(reports.length);
    if (reports.length > 0) {
      setLastImport(reports[0].importedAt);
      const best = Math.max(...reports.map(r => r.results.totalNetProfit));
      setBestProfit(best);
      setProfitBars(reports.slice(0, 10).map(r => r.results.totalNetProfit));
    }

    fetchLive();
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-3xl mx-auto px-4 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent" />
          <span className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">MT5 Journal</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/live"
            className="bg-bg-secondary border border-border rounded-lg p-5 hover:border-accent/50 transition-colors group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold text-text-primary">Live Trading</span>
              </div>
              <StatusDot status={liveStatus} />
            </div>

            {liveStatus === 'connecting' && (
              <div className="flex items-center gap-2 text-text-muted text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting...</span>
              </div>
            )}

            {liveStatus === 'offline' && (
              <p className="text-sm text-text-muted py-4">MT5 bridge offline</p>
            )}

            {liveStatus === 'online' && account && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Balance</span>
                  <span className="text-sm font-mono text-text-primary">{formatCurrency(account.balance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Equity</span>
                  <span className="text-sm font-mono text-profit">{formatCurrency(account.equity)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Positions</span>
                  <span className="text-sm font-mono text-text-primary">{positionCount} open</span>
                </div>
                {equityPoints.length > 1 && (
                  <div className="pt-2">
                    <Sparkline data={equityPoints} color="var(--accent)" height={30} />
                  </div>
                )}
              </div>
            )}
          </Link>

          <Link
            href="/backtests"
            className="bg-bg-secondary border border-border rounded-lg p-5 hover:border-accent/50 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-text-primary">Backtests</span>
            </div>

            {reportCount === 0 ? (
              <p className="text-sm text-text-muted py-4">No reports yet</p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Reports</span>
                  <span className="text-sm font-mono text-text-primary">{reportCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Last Import</span>
                  <span className="text-sm font-mono text-text-primary">
                    {lastImport ? formatDistanceToNow(new Date(lastImport), { addSuffix: true }) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-text-muted uppercase tracking-[0.5px]">Best Profit</span>
                  <span className="text-sm font-mono text-profit">
                    {bestProfit != null ? formatCurrency(bestProfit) : '—'}
                  </span>
                </div>
                {profitBars.length > 1 && (
                  <div className="flex gap-1 items-end h-[30px] pt-2">
                    {profitBars.map((v, i) => {
                      const max = Math.max(...profitBars.map(Math.abs));
                      const h = max > 0 ? (Math.abs(v) / max) * 100 : 0;
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-sm"
                          style={{
                            height: `${Math.max(h, 8)}%`,
                            backgroundColor: v >= 0 ? 'var(--profit)' : 'var(--loss)',
                            opacity: 0.6,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
