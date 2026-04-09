'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { AccountListItem, LiveStatus } from '../../lib/live-types';
import StatusBadge from '../shared/StatusBadge';

interface AccountListProps {
  accounts: AccountListItem[];
  onEdit: (account: AccountListItem) => void;
  onDelete: (id: number) => Promise<void>;
}

function StatusDot({ status }: { status: LiveStatus }) {
  const color = status === 'online' ? 'bg-profit' : 'bg-loss';
  return <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />;
}

export default function AccountList({ accounts, onEdit, onDelete }: AccountListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  async function handleDelete(id: number) {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
    setConfirmId(null);
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-medium text-text-muted uppercase tracking-[0.5px] px-5 py-3">Name</th>
            <th className="text-left text-xs font-medium text-text-muted uppercase tracking-[0.5px] px-5 py-3">Endpoint</th>
            <th className="text-center text-xs font-medium text-text-muted uppercase tracking-[0.5px] px-5 py-3">Status</th>
            <th className="text-right text-xs font-medium text-text-muted uppercase tracking-[0.5px] px-5 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id} className="border-b border-border last:border-b-0">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-text-primary font-medium">{account.name}</span>
                  <StatusBadge label={account.type === 'propfirm' ? 'Prop Firm' : account.type === 'demo' ? 'Demo' : 'Live'} variant={account.type === 'propfirm' ? 'backtest' : account.type === 'demo' ? 'demo' : 'live'} />
                </div>
                <div className="text-xs text-text-muted mt-0.5 font-mono">{account.slug}</div>
              </td>
              <td className="px-5 py-3">
                <span className="text-sm text-text-secondary font-mono">{account.server ?? '—'}</span>
              </td>
              <td className="px-5 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <StatusDot status={account.status} />
                  <span className="text-xs text-text-muted">{account.status === 'online' ? 'Online' : 'Offline'}</span>
                </div>
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-2">
                  {confirmId === account.id ? (
                    <>
                      <span className="text-xs text-text-muted">Delete?</span>
                      <button
                        onClick={() => handleDelete(account.id)}
                        disabled={deletingId === account.id}
                        className="text-xs text-loss hover:text-loss/80 font-medium disabled:opacity-50"
                      >
                        {deletingId === account.id ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-xs text-text-muted hover:text-text-primary"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onEdit(account)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmId(account.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-loss hover:bg-loss/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
