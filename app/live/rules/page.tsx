'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { PropfirmRule } from '../../lib/live-types';
import RuleForm from '../../components/live/RuleForm';
import RuleList from '../../components/live/RuleList';
import EmptyState from '../../components/shared/EmptyState';

type FormMode = { type: 'closed' } | { type: 'add' } | { type: 'edit'; rule: PropfirmRule };

export default function RulesPage() {
  const [rules, setRules] = useState<PropfirmRule[]>([]);
  const [formMode, setFormMode] = useState<FormMode>({ type: 'closed' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/live/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function handleSave(data: Omit<PropfirmRule, 'id'>) {
    setSaving(true);
    setFormError(null);

    try {
      const isEdit = formMode.type === 'edit';
      const url = isEdit ? `/api/live/rules/${formMode.rule.id}` : '/api/live/rules';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? 'Failed to save rule');
        setSaving(false);
        return;
      }

      setFormMode({ type: 'closed' });
      await fetchRules();
    } catch {
      setFormError('Network error — could not save rule');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/live/rules/${id}`, { method: 'DELETE' });
      if (res.ok) await fetchRules();
    } catch {
      // silently fail
    }
  }

  if (loading) return null;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Prop Firm Rule Sets</h2>
          <p className="text-xs text-text-muted mt-0.5">Define challenge objectives for prop firm accounts</p>
        </div>
        {rules.length > 0 && formMode.type === 'closed' && (
          <button
            onClick={() => { setFormMode({ type: 'add' }); setFormError(null); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Rule Set
          </button>
        )}
      </div>

      {formMode.type !== 'closed' && (
        <RuleForm
          initial={formMode.type === 'edit' ? formMode.rule : undefined}
          onSave={handleSave}
          onCancel={() => setFormMode({ type: 'closed' })}
          saving={saving}
          error={formError}
        />
      )}

      {rules.length === 0 && formMode.type === 'closed' ? (
        <EmptyState
          icon={BookOpen}
          title="No rule sets"
          description="Create a rule set to define prop firm challenge objectives."
          action={{ label: 'Add Rule Set', onClick: () => { setFormMode({ type: 'add' }); setFormError(null); } }}
        />
      ) : rules.length > 0 ? (
        <RuleList
          rules={rules}
          onEdit={(rule) => { setFormMode({ type: 'edit', rule }); setFormError(null); }}
          onDelete={handleDelete}
        />
      ) : null}

      <div className="pt-2">
        <Link href="/live/settings" className="text-sm text-text-muted hover:text-text-primary transition-colors">
          ← Back to Account Settings
        </Link>
      </div>
    </main>
  );
}
