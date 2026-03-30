'use client';

import { GitMerge, AlertCircle } from 'lucide-react';

interface MergeBarProps {
  selectedCount: number;
  canMerge: boolean;
  error: string | null;
  onMerge: () => void;
}

export default function MergeBar({ selectedCount, canMerge, error, onMerge }: MergeBarProps) {
  return (
    <div className="border border-warning/30 bg-warning/10 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <GitMerge className="w-5 h-5 text-warning flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-warning">
            {selectedCount === 0
              ? 'Select reports to merge'
              : `${selectedCount} report${selectedCount === 1 ? '' : 's'} selected`}
          </p>
          {error ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <AlertCircle className="w-3.5 h-3.5 text-loss flex-shrink-0" />
              <p className="text-xs text-loss">{error}</p>
            </div>
          ) : (
            <p className="text-xs text-warning/70 mt-0.5">
              Select 2 or more reports with the same symbol to merge
            </p>
          )}
        </div>
      </div>

      <button
        onClick={onMerge}
        disabled={!canMerge}
        className="flex items-center gap-2 px-4 py-2 bg-warning text-bg-primary rounded-lg text-sm font-medium
          hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex-shrink-0"
      >
        <GitMerge className="w-4 h-4" />
        Merge Selected ({selectedCount})
      </button>
    </div>
  );
}
