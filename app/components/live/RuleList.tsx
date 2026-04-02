'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { PropfirmRule } from '../../lib/live-types';

interface RuleListProps {
  rules: PropfirmRule[];
  onEdit: (rule: PropfirmRule) => void;
  onDelete: (id: number) => Promise<void>;
}

function formatValue(value: number, type: 'money' | 'percent'): string {
  if (type === 'money') return `$${value.toLocaleString()}`;
  return `${value}%`;
}

export default function RuleList({ rules, onEdit, onDelete }: RuleListProps) {
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
            <th className="text-right text-xs font-medium text-text-muted uppercase tracking-[0.5px] px-5 py-3">Account Size</th>
            <th className="text-right text-xs font-medium text-text-muted uppercase tracking-[0.5px] px-5 py-3">Daily Loss</th>
            <th className="text-right text-xs font-medium text-text-muted uppercase tracking-[0.5px] px-5 py-3">Total Loss</th>
            <th className="text-right text-xs font-medium text-text-muted uppercase tracking-[0.5px] px-5 py-3">Target</th>
            <th className="text-center text-xs font-medium text-text-muted uppercase tracking-[0.5px] px-5 py-3">Days</th>
            <th className="text-right text-xs font-medium text-text-muted uppercase tracking-[0.5px] px-5 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id} className="border-b border-border last:border-b-0">
              <td className="px-5 py-3 text-sm text-text-primary font-medium">{rule.name}</td>
              <td className="px-5 py-3 text-sm text-text-secondary font-mono text-right">${rule.account_size.toLocaleString()}</td>
              <td className="px-5 py-3 text-sm text-text-secondary font-mono text-right">{formatValue(rule.max_daily_loss, rule.daily_loss_type)}</td>
              <td className="px-5 py-3 text-sm text-text-secondary font-mono text-right">{formatValue(rule.max_total_loss, rule.total_loss_type)}</td>
              <td className="px-5 py-3 text-sm text-text-secondary font-mono text-right">{formatValue(rule.profit_target, rule.target_type)}</td>
              <td className="px-5 py-3 text-sm text-text-secondary text-center">{rule.min_trading_days > 0 ? `${rule.min_trading_days}+` : '—'}</td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-2">
                  {confirmId === rule.id ? (
                    <>
                      <span className="text-xs text-text-muted">Delete?</span>
                      <button onClick={() => handleDelete(rule.id)} disabled={deletingId === rule.id} className="text-xs text-loss hover:text-loss/80 font-medium disabled:opacity-50">
                        {deletingId === rule.id ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmId(null)} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => onEdit(rule)} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmId(rule.id)} className="p-1.5 rounded-lg text-text-muted hover:text-loss hover:bg-loss/10 transition-colors" title="Delete">
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
