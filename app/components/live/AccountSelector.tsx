'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { AccountListItem, LiveStatus } from '../../lib/live-types';

interface AccountSelectorProps {
  selectedId: string | null;
  onSelect: (accountId: string) => void;
}

function StatusDot({ status }: { status: LiveStatus }) {
  const color = status === 'online' ? 'bg-profit' : 'bg-loss';
  return <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />;
}

export default function AccountSelector({ selectedId, onSelect }: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch('/api/live/accounts');
        if (res.ok) {
          const data = await res.json();
          setAccounts(data.accounts);
        }
      } catch {
        // silently fail — will retry on next poll
      }
    }

    fetchAccounts();
    const interval = setInterval(fetchAccounts, 30_000); // refresh status every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = accounts.find((a) => a.id === selectedId);

  if (accounts.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 bg-bg-tertiary border border-border rounded-lg px-3 py-1.5 hover:border-text-muted transition-colors min-w-[180px]"
      >
        {selected && <StatusDot status={selected.status} />}
        <span className="text-sm text-text-primary flex-1 text-left truncate">
          {selected?.name ?? 'Select account'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-secondary border border-border rounded-lg shadow-lg overflow-hidden z-50">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                onSelect(account.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-bg-tertiary transition-colors border-l-2 ${
                account.id === selectedId
                  ? 'border-l-accent bg-accent/5'
                  : 'border-l-transparent'
              }`}
            >
              <StatusDot status={account.status} />
              <div className="min-w-0 flex-1">
                <div className={`text-sm truncate ${account.status === 'offline' ? 'text-text-muted' : 'text-text-primary'}`}>
                  {account.name}
                </div>
                <div className="text-xs text-text-muted truncate">
                  {account.status === 'online' && account.server
                    ? `${account.server} · #${account.login}`
                    : 'Offline'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
