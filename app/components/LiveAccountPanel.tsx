'use client';

import { Wifi, WifiOff, Loader2, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { LiveAccountInfo, LiveStatus } from '../lib/live-types';

interface LiveAccountPanelProps {
  status: LiveStatus;
  account: LiveAccountInfo | null;
  lastUpdated: Date | null;
}

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function StatusBadge({ status }: { status: LiveStatus }) {
  if (status === 'connecting') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-zinc-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Connecting...
      </span>
    );
  }
  if (status === 'online') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
        <Wifi className="w-3.5 h-3.5" />
        Live
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-red-400">
      <WifiOff className="w-3.5 h-3.5" />
      Offline
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-800/60 rounded-lg p-4 flex items-start gap-3">
      {icon && (
        <div className="p-2 bg-zinc-700/60 rounded-lg shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
        <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function LiveAccountPanel({ status, account, lastUpdated }: LiveAccountPanelProps) {
  const currency = account?.currency ?? 'USD';
  const floatingColor = account && account.floating_pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const ddColor = account && account.drawdown_pct > 3 ? 'text-orange-400' : 'text-zinc-300';

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-white">Live Account</h2>
          {account && (
            <p className="text-xs text-zinc-500 mt-0.5">
              #{account.login} · {account.server}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={status} />
          {lastUpdated && (
            <span className="text-xs text-zinc-600">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {status === 'offline' && !account && (
        <div className="flex items-center gap-3 text-zinc-500 py-4">
          <WifiOff className="w-5 h-5 shrink-0" />
          <p className="text-sm">MT5 bridge offline. Start the VPS bridge and SSH tunnel to see live data.</p>
        </div>
      )}

      {account && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Balance"
            value={formatCurrency(account.balance, currency)}
            icon={<DollarSign className="w-4 h-4 text-zinc-400" />}
          />
          <StatCard
            label="Equity"
            value={formatCurrency(account.equity, currency)}
            icon={<TrendingUp className="w-4 h-4 text-zinc-400" />}
          />
          <StatCard
            label="Floating P/L"
            value={formatCurrency(account.floating_pnl, currency)}
            color={floatingColor}
            icon={account.floating_pnl >= 0
              ? <TrendingUp className="w-4 h-4 text-emerald-400" />
              : <TrendingDown className="w-4 h-4 text-red-400" />
            }
          />
          <StatCard
            label="Drawdown"
            value={`${account.drawdown_pct.toFixed(2)}%`}
            sub={`Free margin: ${formatCurrency(account.free_margin, currency)}`}
            color={ddColor}
            icon={<AlertTriangle className={`w-4 h-4 ${ddColor}`} />}
          />
        </div>
      )}
    </div>
  );
}
