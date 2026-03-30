'use client';

import { useMemo } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { LiveAccountInfo, LiveStatus, LiveTrade } from '../../lib/live-types';
import StatCard from '../shared/StatCard';

interface LiveAccountPanelProps {
  status: LiveStatus;
  account: LiveAccountInfo | null;
  lastUpdated: Date | null;
  trades: LiveTrade[];
}

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function ConnectionStatus({ status }: { status: LiveStatus }) {
  if (status === 'connecting') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-warning">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Connecting...
      </span>
    );
  }
  if (status === 'online') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-profit">
        <Wifi className="w-3.5 h-3.5" />
        Live
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-loss">
      <WifiOff className="w-3.5 h-3.5" />
      Offline
    </span>
  );
}

export default function LiveAccountPanel({ status, account, lastUpdated, trades }: LiveAccountPanelProps) {
  const currency = account?.currency ?? 'USD';

  const startingCapital = useMemo(() => {
    if (!account) return null;
    const totalPnl = trades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
    return account.balance - totalPnl;
  }, [account, trades]);

  const floatingVariant = account && account.floating_pnl >= 0 ? 'profit' : 'loss';
  const drawdownVariant = account && account.drawdown_pct > 3 ? 'warning' : 'default';

  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Live Account</h2>
          {account && (
            <p className="text-xs text-text-muted mt-0.5 font-mono">
              #{account.login} · {account.server}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <ConnectionStatus status={status} />
          {lastUpdated && (
            <span className="text-xs text-text-muted font-mono">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {status === 'offline' && !account && (
        <div className="flex items-center gap-3 text-text-muted py-4">
          <WifiOff className="w-5 h-5 shrink-0 text-loss" />
          <p className="text-sm">MT5 bridge offline. Start the VPS bridge and SSH tunnel to see live data.</p>
        </div>
      )}

      {account && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {startingCapital != null && (
            <StatCard
              label="Starting Capital"
              value={formatCurrency(startingCapital, currency)}
            />
          )}
          <StatCard
            label="Balance"
            value={formatCurrency(account.balance, currency)}
          />
          <StatCard
            label="Equity"
            value={formatCurrency(account.equity, currency)}
          />
          <StatCard
            label="Floating P/L"
            value={formatCurrency(account.floating_pnl, currency)}
            secondaryValue={account.floating_pnl >= 0 ? 'Unrealized gain' : 'Unrealized loss'}
            variant={floatingVariant}
          />
          <StatCard
            label="Drawdown"
            value={`${account.drawdown_pct.toFixed(2)}%`}
            secondaryValue={`Free margin: ${formatCurrency(account.free_margin, currency)}`}
            variant={drawdownVariant}
          />
        </div>
      )}
    </div>
  );
}
