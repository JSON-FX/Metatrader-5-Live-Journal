import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="p-4 bg-bg-tertiary rounded-2xl mb-6">
        <Icon className="w-12 h-12 text-text-muted" />
      </div>
      <h2 className="text-2xl font-bold text-text-primary mb-2">{title}</h2>
      {description && (
        <p className="text-text-secondary text-center max-w-md mb-8">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
