type BadgeVariant = 'buy' | 'sell' | 'online' | 'offline' | 'connecting' | 'backtest' | 'forward' | 'live' | 'demo' | 'merged';

const variantStyles: Record<BadgeVariant, string> = {
  buy: 'bg-profit/20 text-profit',
  sell: 'bg-loss/20 text-loss',
  online: 'bg-profit/20 text-profit',
  offline: 'bg-loss/20 text-loss',
  connecting: 'bg-warning/20 text-warning',
  backtest: 'bg-purple-500/20 text-purple-400',
  forward: 'bg-profit/20 text-profit',
  live: 'bg-accent/20 text-accent',
  demo: 'bg-teal-500/20 text-teal-400',
  merged: 'bg-warning/20 text-warning',
};

interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
}

export default function StatusBadge({ label, variant }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]}`}>
      {label}
    </span>
  );
}
