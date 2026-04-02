'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Server } from 'lucide-react';
import Link from 'next/link';
import { AccountListItem } from '../../lib/live-types';
import AccountForm from '../../components/live/AccountForm';
import AccountList from '../../components/live/AccountList';
import EmptyState from '../../components/shared/EmptyState';

type FormMode = { type: 'closed' } | { type: 'add' } | { type: 'edit'; account: AccountListItem; endpoint: string };

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [formMode, setFormMode] = useState<FormMode>({ type: 'closed' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/live/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  async function handleSave(data: { slug: string; name: string; type: 'live' | 'propfirm'; endpoint: string }) {
    setSaving(true);
    setFormError(null);

    try {
      const isEdit = formMode.type === 'edit';
      const url = isEdit ? `/api/live/accounts/${formMode.account.id}` : '/api/live/accounts';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? 'Failed to save account');
        setSaving(false);
        return;
      }

      setFormMode({ type: 'closed' });
      await fetchAccounts();
    } catch {
      setFormError('Network error — could not save account');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/live/accounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAccounts();
      }
    } catch {
      // silently fail
    }
  }

  async function handleEdit(account: AccountListItem) {
    setFormError(null);
    try {
      const res = await fetch(`/api/live/accounts/${account.id}/detail`);
      if (res.ok) {
        const detail = await res.json();
        setFormMode({ type: 'edit', account, endpoint: detail.endpoint });
      }
    } catch {
      setFormError('Could not load account details');
    }
  }

  if (loading) return null;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Account Settings</h2>
          <p className="text-xs text-text-muted mt-0.5">Manage your MT5 account connections</p>
        </div>
        {accounts.length > 0 && formMode.type === 'closed' && (
          <button
            onClick={() => { setFormMode({ type: 'add' }); setFormError(null); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        )}
      </div>

      {formMode.type !== 'closed' && (
        <AccountForm
          initial={formMode.type === 'edit' ? {
            slug: formMode.account.slug,
            name: formMode.account.name,
            type: formMode.account.type,
            endpoint: formMode.endpoint,
          } : undefined}
          onSave={handleSave}
          onCancel={() => setFormMode({ type: 'closed' })}
          saving={saving}
          error={formError}
        />
      )}

      {accounts.length === 0 && formMode.type === 'closed' ? (
        <EmptyState
          icon={Server}
          title="No accounts configured"
          description="Add an MT5 account to connect to your trading terminal."
          action={{ label: 'Add Account', onClick: () => { setFormMode({ type: 'add' }); setFormError(null); } }}
        />
      ) : accounts.length > 0 ? (
        <AccountList
          accounts={accounts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : null}

      <div className="pt-2">
        <Link
          href="/live"
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
