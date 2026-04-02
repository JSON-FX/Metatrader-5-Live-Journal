'use client';

import { useState, useEffect } from 'react';

interface AccountFormData {
  slug: string;
  name: string;
  type: 'live' | 'propfirm';
  endpoint: string;
  rule_id: number | null;
}

interface AccountFormProps {
  initial?: AccountFormData;
  rules?: { id: number; name: string }[];
  onSave: (data: AccountFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function AccountForm({ initial, rules, onSave, onCancel, saving, error }: AccountFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [type, setType] = useState<'live' | 'propfirm'>(initial?.type ?? 'live');
  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? '');
  const [ruleId, setRuleId] = useState<number | null>(initial?.rule_id ?? null);
  const [slugTouched, setSlugTouched] = useState(!!initial);

  useEffect(() => {
    if (!slugTouched && !initial) {
      setSlug(toSlug(name));
    }
  }, [name, slugTouched, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({ slug, name, type, endpoint, rule_id: type === 'propfirm' ? ruleId : null });
  }

  const inputClass = 'w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors';
  const labelClass = 'block text-xs font-medium text-text-secondary uppercase tracking-[0.5px] mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="bg-bg-secondary border border-border rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">
        {initial ? 'Edit Account' : 'Add Account'}
      </h3>

      {error && (
        <div className="text-sm text-loss bg-loss/10 border border-loss/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Live Trading"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
            placeholder="live-trading"
            required
            pattern="[a-z0-9-]+"
            title="Lowercase letters, numbers, and hyphens only"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'live' | 'propfirm')}
            className={inputClass}
          >
            <option value="live">Live</option>
            <option value="propfirm">Prop Firm</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Endpoint</label>
          <input
            type="url"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="http://host.docker.internal:5555"
            required
            className={inputClass}
          />
        </div>
        {type === 'propfirm' && rules && rules.length > 0 && (
          <div>
            <label className={labelClass}>Rule Set</label>
            <select
              value={ruleId ?? ''}
              onChange={(e) => setRuleId(e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
            >
              <option value="">None</option>
              {rules.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg text-sm font-medium hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
