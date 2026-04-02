'use client';

import { DisplayMode } from '../../lib/live-types';

interface DisplayModeToggleProps {
  mode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}

const MODES: { id: DisplayMode; label: string }[] = [
  { id: 'money', label: '$' },
  { id: 'percent', label: '%' },
];

export default function DisplayModeToggle({ mode, onChange }: DisplayModeToggleProps) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-border">
      {MODES.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
            mode === m.id
              ? 'bg-bg-tertiary text-text-primary'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
