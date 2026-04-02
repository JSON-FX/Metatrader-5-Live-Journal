'use client';

import { useState } from 'react';
import { PropfirmRule } from '../../lib/live-types';

interface RuleFormProps {
  initial?: PropfirmRule;
  onSave: (data: Omit<PropfirmRule, 'id'>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

export default function RuleForm({ initial, onSave, onCancel, saving, error }: RuleFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [accountSize, setAccountSize] = useState(initial?.account_size?.toString() ?? '');
  const [maxDailyLoss, setMaxDailyLoss] = useState(initial?.max_daily_loss?.toString() ?? '');
  const [dailyLossType, setDailyLossType] = useState<'money' | 'percent'>(initial?.daily_loss_type ?? 'percent');
  const [dailyLossCalc, setDailyLossCalc] = useState<'balance' | 'equity'>(initial?.daily_loss_calc ?? 'balance');
  const [maxTotalLoss, setMaxTotalLoss] = useState(initial?.max_total_loss?.toString() ?? '');
  const [totalLossType, setTotalLossType] = useState<'money' | 'percent'>(initial?.total_loss_type ?? 'percent');
  const [profitTarget, setProfitTarget] = useState(initial?.profit_target?.toString() ?? '');
  const [targetType, setTargetType] = useState<'money' | 'percent'>(initial?.target_type ?? 'percent');
  const [minDays, setMinDays] = useState(initial?.min_trading_days?.toString() ?? '0');
  const [maxDays, setMaxDays] = useState(initial?.max_trading_days?.toString() ?? '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({
      name,
      account_size: Number(accountSize),
      max_daily_loss: Number(maxDailyLoss),
      daily_loss_type: dailyLossType,
      daily_loss_calc: dailyLossCalc,
      max_total_loss: Number(maxTotalLoss),
      total_loss_type: totalLossType,
      profit_target: Number(profitTarget),
      target_type: targetType,
      min_trading_days: Number(minDays),
      max_trading_days: maxDays ? Number(maxDays) : null,
    });
  }

  const inputClass = 'w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors';
  const labelClass = 'block text-xs font-medium text-text-secondary uppercase tracking-[0.5px] mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="bg-bg-secondary border border-border rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">
        {initial ? 'Edit Rule Set' : 'Add Rule Set'}
      </h3>

      {error && (
        <div className="text-sm text-loss bg-loss/10 border border-loss/20 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="FTMO Challenge 10k" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Account Size ($)</label>
          <input type="number" step="0.01" value={accountSize} onChange={(e) => setAccountSize(e.target.value)} placeholder="10000" required className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Max Daily Loss</label>
          <input type="number" step="0.01" value={maxDailyLoss} onChange={(e) => setMaxDailyLoss(e.target.value)} placeholder="5" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Daily Loss Unit</label>
          <select value={dailyLossType} onChange={(e) => setDailyLossType(e.target.value as 'money' | 'percent')} className={inputClass}>
            <option value="percent">Percent (%)</option>
            <option value="money">Dollar ($)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Daily Loss Calculation</label>
          <select value={dailyLossCalc} onChange={(e) => setDailyLossCalc(e.target.value as 'balance' | 'equity')} className={inputClass}>
            <option value="balance">Balance-based</option>
            <option value="equity">Equity-based</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Max Total Loss</label>
          <input type="number" step="0.01" value={maxTotalLoss} onChange={(e) => setMaxTotalLoss(e.target.value)} placeholder="10" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Total Loss Unit</label>
          <select value={totalLossType} onChange={(e) => setTotalLossType(e.target.value as 'money' | 'percent')} className={inputClass}>
            <option value="percent">Percent (%)</option>
            <option value="money">Dollar ($)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Profit Target</label>
          <input type="number" step="0.01" value={profitTarget} onChange={(e) => setProfitTarget(e.target.value)} placeholder="10" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Target Unit</label>
          <select value={targetType} onChange={(e) => setTargetType(e.target.value as 'money' | 'percent')} className={inputClass}>
            <option value="percent">Percent (%)</option>
            <option value="money">Dollar ($)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Min Trading Days</label>
          <input type="number" value={minDays} onChange={(e) => setMinDays(e.target.value)} placeholder="0" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Max Trading Days (empty = unlimited)</label>
          <input type="number" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} placeholder="Unlimited" className={inputClass} />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg text-sm font-medium hover:text-text-primary transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
