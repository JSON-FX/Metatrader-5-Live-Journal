'use client';

export type TabId = 'overview' | 'trades' | 'calendar' | 'performance';

interface LiveTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'trades', label: 'Trades' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'performance', label: 'Performance' },
];

export default function LiveTabs({ activeTab, onTabChange }: LiveTabsProps) {
  return (
    <div className="flex gap-0 border-b border-border">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.5px] transition-colors border-b-2 -mb-px ${
            activeTab === tab.id
              ? 'text-accent border-b-accent'
              : 'text-text-muted border-b-transparent hover:text-text-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
