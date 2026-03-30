interface StatCardProps {
  label: string;
  value: string;
  secondaryValue?: string;
  variant?: 'default' | 'profit' | 'loss' | 'warning' | 'accent';
}

const variantStyles: Record<string, string> = {
  default: 'text-text-primary',
  profit: 'text-profit',
  loss: 'text-loss',
  warning: 'text-warning',
  accent: 'text-accent',
};

export default function StatCard({ label, value, secondaryValue, variant = 'default' }: StatCardProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <p className="text-[11px] text-text-muted uppercase tracking-[1px] font-sans">{label}</p>
      <p className={`text-xl font-semibold font-mono mt-1 ${variantStyles[variant]}`}>{value}</p>
      {secondaryValue && (
        <p className="text-xs text-text-muted mt-0.5 font-mono">{secondaryValue}</p>
      )}
    </div>
  );
}
