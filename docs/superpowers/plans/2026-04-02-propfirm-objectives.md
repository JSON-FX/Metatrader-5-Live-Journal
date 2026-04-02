# Prop Firm Objectives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prop firm rule templates and an Objectives tab showing real-time progress against challenge objectives (max daily loss, max total loss, profit target, min trading days).

**Architecture:** A new `propfirm_rules` table stores reusable rule templates. Prop firm accounts reference a rule via `rule_id`. The Objectives tab (visible only for prop firm accounts with rules) calculates objective status client-side from trade history and account data. A separate rules management page at `/live/rules` provides CRUD for templates.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, mysql2/promise, lucide-react

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `app/lib/rules.ts` | CRUD functions for propfirm_rules table |
| `app/lib/objectives.ts` | Pure functions: calculate objective status, discipline score |
| `app/api/live/rules/route.ts` | GET (list) + POST (create) rules |
| `app/api/live/rules/[id]/route.ts` | GET + PUT + DELETE individual rules |
| `app/live/rules/page.tsx` | Rules management page |
| `app/components/live/RuleForm.tsx` | Add/edit form for rule templates |
| `app/components/live/RuleList.tsx` | List of rule templates |
| `app/components/live/ObjectivesTab.tsx` | Objectives tab component |

### Modified Files

| File | Change |
|------|--------|
| `app/lib/db.ts` | Add `propfirm_rules` table + `rule_id` column to `mt5_accounts` |
| `app/lib/live-types.ts` | Add `PropfirmRule`, `ObjectiveResult` types, `rule_id` to `AccountConfig`/`AccountListItem` |
| `app/lib/accounts.ts` | Include `rule_id` in all account queries and CRUD |
| `app/api/live/accounts/route.ts` | Include `rule_id` in GET response, accept in POST |
| `app/api/live/accounts/[id]/route.ts` | Accept `rule_id` in PUT |
| `app/api/live/accounts/[id]/detail/route.ts` | Include full rule data when `rule_id` is set |
| `app/components/live/LiveTabs.tsx` | Accept `showObjectives` prop, conditionally include Objectives tab |
| `app/components/live/AccountForm.tsx` | Add `rule_id` dropdown for propfirm accounts |
| `app/live/page.tsx` | Fetch rule data, pass to ObjectivesTab, conditional tab visibility |
| `app/live/settings/page.tsx` | Add link to rules page, pass `rule_id` through account form |

---

### Task 1: Database Schema — Rules Table and rule_id Column

**Files:**
- Modify: `app/lib/db.ts`
- Modify: `app/lib/live-types.ts`

- [ ] **Step 1: Update `app/lib/db.ts` to create `propfirm_rules` table and add `rule_id` column**

In the `ensureDatabase` function, after the `mt5_accounts` table creation, add:

```typescript
  await p.execute(`
    CREATE TABLE IF NOT EXISTS propfirm_rules (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      name            VARCHAR(100) NOT NULL,
      account_size    DECIMAL(12,2) NOT NULL,
      max_daily_loss  DECIMAL(8,2) NOT NULL,
      daily_loss_type ENUM('money','percent') NOT NULL DEFAULT 'percent',
      daily_loss_calc ENUM('balance','equity') NOT NULL DEFAULT 'balance',
      max_total_loss  DECIMAL(8,2) NOT NULL,
      total_loss_type ENUM('money','percent') NOT NULL DEFAULT 'percent',
      profit_target   DECIMAL(8,2) NOT NULL,
      target_type     ENUM('money','percent') NOT NULL DEFAULT 'percent',
      min_trading_days INT NOT NULL DEFAULT 0,
      max_trading_days INT DEFAULT NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Add rule_id column to mt5_accounts if it doesn't exist
  try {
    await p.execute(`ALTER TABLE mt5_accounts ADD COLUMN rule_id INT DEFAULT NULL`);
  } catch {
    // Column already exists — ignore
  }
```

- [ ] **Step 2: Add types to `app/lib/live-types.ts`**

Add these interfaces at the end of the file:

```typescript
export interface PropfirmRule {
  id: number;
  name: string;
  account_size: number;
  max_daily_loss: number;
  daily_loss_type: 'money' | 'percent';
  daily_loss_calc: 'balance' | 'equity';
  max_total_loss: number;
  total_loss_type: 'money' | 'percent';
  profit_target: number;
  target_type: 'money' | 'percent';
  min_trading_days: number;
  max_trading_days: number | null;
}

export type ObjectiveStatus = 'passing' | 'failed' | 'in_progress';

export interface ObjectiveResult {
  name: string;
  result: string;
  target: string;
  status: ObjectiveStatus;
}
```

Also add `rule_id` to `AccountConfig` and `AccountListItem`:

In `AccountConfig`, add after `sort_order`:
```typescript
  rule_id: number | null;
```

In `AccountListItem`, add after `login`:
```typescript
  rule_id: number | null;
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add app/lib/db.ts app/lib/live-types.ts
git commit -m "feat: add propfirm_rules table and rule_id column to accounts"
```

---

### Task 2: Rules CRUD Library

**Files:**
- Create: `app/lib/rules.ts`
- Modify: `app/lib/accounts.ts`

- [ ] **Step 1: Create `app/lib/rules.ts`**

```typescript
import { getDb } from './db';
import { PropfirmRule } from './live-types';
import { RowDataPacket } from 'mysql2';

export async function loadRules(): Promise<PropfirmRule[]> {
  try {
    const db = await getDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, account_size, max_daily_loss, daily_loss_type, daily_loss_calc, max_total_loss, total_loss_type, profit_target, target_type, min_trading_days, max_trading_days FROM propfirm_rules ORDER BY name ASC'
    );
    return rows as PropfirmRule[];
  } catch {
    return [];
  }
}

export async function getRuleById(id: number): Promise<PropfirmRule | null> {
  try {
    const db = await getDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, account_size, max_daily_loss, daily_loss_type, daily_loss_calc, max_total_loss, total_loss_type, profit_target, target_type, min_trading_days, max_trading_days FROM propfirm_rules WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as PropfirmRule) : null;
  } catch {
    return null;
  }
}

export async function createRule(data: Omit<PropfirmRule, 'id'>): Promise<PropfirmRule> {
  const db = await getDb();
  const [result] = await db.execute(
    'INSERT INTO propfirm_rules (name, account_size, max_daily_loss, daily_loss_type, daily_loss_calc, max_total_loss, total_loss_type, profit_target, target_type, min_trading_days, max_trading_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [data.name, data.account_size, data.max_daily_loss, data.daily_loss_type, data.daily_loss_calc, data.max_total_loss, data.total_loss_type, data.profit_target, data.target_type, data.min_trading_days, data.max_trading_days]
  );
  const insertId = (result as { insertId: number }).insertId;
  return (await getRuleById(insertId))!;
}

export async function updateRule(id: number, data: Partial<Omit<PropfirmRule, 'id'>>): Promise<PropfirmRule | null> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  const fieldMap: Record<string, keyof typeof data> = {
    'name': 'name', 'account_size': 'account_size',
    'max_daily_loss': 'max_daily_loss', 'daily_loss_type': 'daily_loss_type',
    'daily_loss_calc': 'daily_loss_calc', 'max_total_loss': 'max_total_loss',
    'total_loss_type': 'total_loss_type', 'profit_target': 'profit_target',
    'target_type': 'target_type', 'min_trading_days': 'min_trading_days',
    'max_trading_days': 'max_trading_days',
  };

  for (const [col, key] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(data[key] as string | number | null);
    }
  }

  if (fields.length === 0) return getRuleById(id);

  values.push(id);
  const db = await getDb();
  await db.execute(`UPDATE propfirm_rules SET ${fields.join(', ')} WHERE id = ?`, values);
  return getRuleById(id);
}

export async function deleteRule(id: number): Promise<boolean> {
  const db = await getDb();
  // Set rule_id to NULL on accounts referencing this rule
  await db.execute('UPDATE mt5_accounts SET rule_id = NULL WHERE rule_id = ?', [id]);
  const [result] = await db.execute('DELETE FROM propfirm_rules WHERE id = ?', [id]);
  return (result as { affectedRows: number }).affectedRows > 0;
}
```

- [ ] **Step 2: Update `app/lib/accounts.ts` to include `rule_id`**

Update `loadAccounts` SELECT to include `rule_id`:
```typescript
'SELECT id, slug, name, type, endpoint, sort_order, rule_id FROM mt5_accounts ORDER BY sort_order ASC, id ASC'
```

Update `getAccountById` SELECT to include `rule_id`:
```typescript
'SELECT id, slug, name, type, endpoint, sort_order, rule_id FROM mt5_accounts WHERE id = ?'
```

Update `createAccount` to accept and insert `rule_id`:
```typescript
export async function createAccount(data: { slug: string; name: string; type: string; endpoint: string; rule_id?: number | null }): Promise<AccountConfig> {
  const db = await getDb();
  const [result] = await db.execute(
    'INSERT INTO mt5_accounts (slug, name, type, endpoint, rule_id) VALUES (?, ?, ?, ?, ?)',
    [data.slug, data.name, data.type, data.endpoint, data.rule_id ?? null]
  );
  const insertId = (result as { insertId: number }).insertId;
  return (await getAccountById(insertId))!;
}
```

Update `updateAccount` to accept `rule_id`:
```typescript
export async function updateAccount(id: number, data: { slug?: string; name?: string; type?: string; endpoint?: string; rule_id?: number | null }): Promise<AccountConfig | null> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
  if (data.endpoint !== undefined) { fields.push('endpoint = ?'); values.push(data.endpoint); }
  if (data.rule_id !== undefined) { fields.push('rule_id = ?'); values.push(data.rule_id); }

  if (fields.length === 0) return getAccountById(id);

  values.push(id);
  const db = await getDb();
  await db.execute(`UPDATE mt5_accounts SET ${fields.join(', ')} WHERE id = ?`, values);
  return getAccountById(id);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/rules.ts app/lib/accounts.ts
git commit -m "feat: add rules CRUD library and rule_id to account operations"
```

---

### Task 3: Rules API Routes

**Files:**
- Create: `app/api/live/rules/route.ts`
- Create: `app/api/live/rules/[id]/route.ts`

- [ ] **Step 1: Create `app/api/live/rules/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { loadRules, createRule } from '../../../lib/rules';

export async function GET() {
  const rules = await loadRules();
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, account_size, max_daily_loss, daily_loss_type, daily_loss_calc, max_total_loss, total_loss_type, profit_target, target_type, min_trading_days, max_trading_days } = body;

    if (!name || !account_size || max_daily_loss == null || max_total_loss == null || profit_target == null) {
      return NextResponse.json({ error: 'name, account_size, max_daily_loss, max_total_loss, and profit_target are required' }, { status: 400 });
    }

    const rule = await createRule({
      name,
      account_size: Number(account_size),
      max_daily_loss: Number(max_daily_loss),
      daily_loss_type: daily_loss_type ?? 'percent',
      daily_loss_calc: daily_loss_calc ?? 'balance',
      max_total_loss: Number(max_total_loss),
      total_loss_type: total_loss_type ?? 'percent',
      profit_target: Number(profit_target),
      target_type: target_type ?? 'percent',
      min_trading_days: Number(min_trading_days ?? 0),
      max_trading_days: max_trading_days != null ? Number(max_trading_days) : null,
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create rule' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/live/rules/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getRuleById, updateRule, deleteRule } from '../../../../lib/rules';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid rule ID' }, { status: 400 });
  }

  const rule = await getRuleById(id);
  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  return NextResponse.json(rule);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid rule ID' }, { status: 400 });
  }

  const existing = await getRuleById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const updated = await updateRule(id, body);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update rule' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid rule ID' }, { status: 400 });
  }

  const deleted = await deleteRule(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/live/rules/route.ts app/api/live/rules/\[id\]/route.ts
git commit -m "feat: add rules API routes (GET, POST, PUT, DELETE)"
```

---

### Task 4: Update Account API Routes for rule_id

**Files:**
- Modify: `app/api/live/accounts/route.ts`
- Modify: `app/api/live/accounts/[id]/route.ts`
- Modify: `app/api/live/accounts/[id]/detail/route.ts`

- [ ] **Step 1: Update `app/api/live/accounts/route.ts`**

In the GET handler, add `rule_id` to both the online and offline return objects:
```typescript
            rule_id: account.rule_id,
```

In the POST handler, accept `rule_id`:
```typescript
    const { slug, name, type, endpoint, rule_id } = body;
    // ...
    const account = await createAccount({ slug, name, type: type ?? 'live', endpoint, rule_id: rule_id ?? null });
```

- [ ] **Step 2: Update `app/api/live/accounts/[id]/route.ts`**

In the PUT handler, accept and pass `rule_id`:
```typescript
    const { slug, name, type, endpoint, rule_id } = body;
    // ...
    const updated = await updateAccount(id, { slug, name, type, endpoint, rule_id });
```

- [ ] **Step 3: Update `app/api/live/accounts/[id]/detail/route.ts`**

Include rule data when `rule_id` is set:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAccountById } from '../../../../../lib/accounts';
import { getRuleById } from '../../../../../lib/rules';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  const account = await getAccountById(id);
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const rule = account.rule_id ? await getRuleById(account.rule_id) : null;

  return NextResponse.json({ ...account, rule });
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/live/accounts/route.ts app/api/live/accounts/\[id\]/route.ts app/api/live/accounts/\[id\]/detail/route.ts
git commit -m "feat: include rule_id in account API routes"
```

---

### Task 5: Rules Management UI (RuleForm + RuleList + Page)

**Files:**
- Create: `app/components/live/RuleForm.tsx`
- Create: `app/components/live/RuleList.tsx`
- Create: `app/live/rules/page.tsx`

- [ ] **Step 1: Create `app/components/live/RuleForm.tsx`**

```typescript
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
  const selectClass = inputClass;

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
          <select value={dailyLossType} onChange={(e) => setDailyLossType(e.target.value as 'money' | 'percent')} className={selectClass}>
            <option value="percent">Percent (%)</option>
            <option value="money">Dollar ($)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Daily Loss Calculation</label>
          <select value={dailyLossCalc} onChange={(e) => setDailyLossCalc(e.target.value as 'balance' | 'equity')} className={selectClass}>
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
          <select value={totalLossType} onChange={(e) => setTotalLossType(e.target.value as 'money' | 'percent')} className={selectClass}>
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
          <select value={targetType} onChange={(e) => setTargetType(e.target.value as 'money' | 'percent')} className={selectClass}>
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
```

- [ ] **Step 2: Create `app/components/live/RuleList.tsx`**

```typescript
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
```

- [ ] **Step 3: Create `app/live/rules/page.tsx`**

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add app/components/live/RuleForm.tsx app/components/live/RuleList.tsx app/live/rules/page.tsx
git commit -m "feat: add rules management page with CRUD UI"
```

---

### Task 6: Account Settings Integration (rule_id dropdown + rules link)

**Files:**
- Modify: `app/components/live/AccountForm.tsx`
- Modify: `app/live/settings/page.tsx`

- [ ] **Step 1: Update `app/components/live/AccountForm.tsx`**

Add `rule_id` to `AccountFormData`:
```typescript
interface AccountFormData {
  slug: string;
  name: string;
  type: 'live' | 'propfirm';
  endpoint: string;
  rule_id: number | null;
}
```

Add `rules` prop to `AccountFormProps`:
```typescript
interface AccountFormProps {
  initial?: AccountFormData;
  rules?: { id: number; name: string }[];
  onSave: (data: AccountFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}
```

Add `rule_id` state and the dropdown (only shown when type is `propfirm`):
```typescript
  const [ruleId, setRuleId] = useState<number | null>(initial?.rule_id ?? null);
```

In the form grid, after the Endpoint field, add:
```typescript
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
```

Update `handleSubmit` to include `rule_id`:
```typescript
    await onSave({ slug, name, type, endpoint, rule_id: type === 'propfirm' ? ruleId : null });
```

- [ ] **Step 2: Update `app/live/settings/page.tsx`**

Add a link to the rules page in the header area (after the "Add Account" button):
```typescript
        <Link href="/live/rules" className="text-sm text-accent hover:text-accent/80 transition-colors">
          Manage Rule Sets
        </Link>
```

Fetch rules for the account form:
```typescript
  const [rules, setRules] = useState<{ id: number; name: string }[]>([]);

  // In fetchAccounts or a separate useEffect:
  useEffect(() => {
    fetch('/api/live/rules').then(r => r.json()).then(d => setRules(d.rules ?? [])).catch(() => {});
  }, []);
```

Pass `rules` to `AccountForm`:
```typescript
        <AccountForm
          rules={rules}
          // ... existing props
        />
```

Update `handleSave` to include `rule_id`:
```typescript
  async function handleSave(data: { slug: string; name: string; type: 'live' | 'propfirm'; endpoint: string; rule_id: number | null }) {
```

Update the `handleEdit` function to include `rule_id` from the detail endpoint:
```typescript
        setFormMode({ type: 'edit', account, endpoint: detail.endpoint, ruleId: detail.rule_id ?? null });
```

Update the `FormMode` type:
```typescript
type FormMode = { type: 'closed' } | { type: 'add' } | { type: 'edit'; account: AccountListItem; endpoint: string; ruleId: number | null };
```

Pass `rule_id` to initial:
```typescript
          initial={formMode.type === 'edit' ? {
            slug: formMode.account.slug,
            name: formMode.account.name,
            type: formMode.account.type,
            endpoint: formMode.endpoint,
            rule_id: formMode.ruleId,
          } : undefined}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/live/AccountForm.tsx app/live/settings/page.tsx
git commit -m "feat: add rule set dropdown to account form and link to rules page"
```

---

### Task 7: Objectives Calculation Library

**Files:**
- Create: `app/lib/objectives.ts`

- [ ] **Step 1: Create `app/lib/objectives.ts`**

```typescript
import { LiveTrade, LiveAccountInfo, PropfirmRule, ObjectiveResult, ObjectiveStatus } from './live-types';

function resolveLimit(value: number, type: 'money' | 'percent', accountSize: number): number {
  return type === 'percent' ? (value / 100) * accountSize : value;
}

function formatLimit(value: number, type: 'money' | 'percent'): string {
  if (type === 'percent') return `${value}%`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatMoney(value: number): string {
  return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export function calculateObjectives(
  rule: PropfirmRule,
  trades: LiveTrade[],
  account: LiveAccountInfo | null,
): ObjectiveResult[] {
  const results: ObjectiveResult[] = [];
  const equity = account?.equity ?? rule.account_size;
  const balance = account?.balance ?? rule.account_size;

  // --- Profit Target ---
  const targetLimit = resolveLimit(rule.profit_target, rule.target_type, rule.account_size);
  const currentProfit = balance - rule.account_size;
  const targetStatus: ObjectiveStatus = currentProfit >= targetLimit ? 'passing' : 'in_progress';
  results.push({
    name: 'Profit Target',
    result: formatMoney(currentProfit),
    target: formatLimit(rule.profit_target, rule.target_type),
    status: targetStatus,
  });

  // --- Max Daily Loss ---
  const dailyLimit = resolveLimit(rule.max_daily_loss, rule.daily_loss_type, rule.account_size);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter(t => t.close_time.startsWith(todayStr));
  const todayPnl = todayTrades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
  // For balance-based: daily loss = negative pnl today (simplified — true calculation needs day's starting balance)
  // For equity-based: would need intraday equity tracking which we don't have
  // Using realized PnL + floating as approximation
  const floatingPnl = account?.floating_pnl ?? 0;
  const dailyLoss = Math.abs(Math.min(0, todayPnl + floatingPnl));
  const dailyStatus: ObjectiveStatus = dailyLoss >= dailyLimit ? 'failed' : 'passing';
  results.push({
    name: 'Max Daily Loss',
    result: formatMoney(-dailyLoss),
    target: formatLimit(rule.max_daily_loss, rule.daily_loss_type),
    status: dailyStatus,
  });

  // --- Max Total Loss ---
  const totalLimit = resolveLimit(rule.max_total_loss, rule.total_loss_type, rule.account_size);
  const totalLoss = Math.max(0, rule.account_size - equity);
  const totalStatus: ObjectiveStatus = totalLoss >= totalLimit ? 'failed' : 'passing';
  results.push({
    name: 'Max Total Loss',
    result: formatMoney(-totalLoss),
    target: formatLimit(rule.max_total_loss, rule.total_loss_type),
    status: totalStatus,
  });

  // --- Min Trading Days ---
  if (rule.min_trading_days > 0) {
    const tradeDates = new Set(trades.map(t => t.close_time.slice(0, 10)));
    const tradingDays = tradeDates.size;
    const minDayStatus: ObjectiveStatus = tradingDays >= rule.min_trading_days ? 'passing' : 'in_progress';
    results.push({
      name: 'Minimum Trading Days',
      result: `${tradingDays} days`,
      target: `${rule.min_trading_days} days`,
      status: minDayStatus,
    });
  }

  // --- Max Trading Days ---
  if (rule.max_trading_days != null) {
    const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
    let daysElapsed = 0;
    if (sorted.length > 0) {
      const firstDate = new Date(sorted[0].close_time);
      const now = new Date();
      daysElapsed = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    const maxDayStatus: ObjectiveStatus = daysElapsed > rule.max_trading_days ? 'failed' : 'passing';
    results.push({
      name: 'Maximum Trading Days',
      result: `${daysElapsed} days`,
      target: `${rule.max_trading_days} days`,
      status: maxDayStatus,
    });
  }

  return results;
}

export function calculateDisciplineScore(
  rule: PropfirmRule,
  trades: LiveTrade[],
  account: LiveAccountInfo | null,
): number {
  const equity = account?.equity ?? rule.account_size;
  const balance = account?.balance ?? rule.account_size;
  const scores: number[] = [];

  // Daily loss safety
  const dailyLimit = resolveLimit(rule.max_daily_loss, rule.daily_loss_type, rule.account_size);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter(t => t.close_time.startsWith(todayStr));
  const todayPnl = todayTrades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
  const floatingPnl = account?.floating_pnl ?? 0;
  const dailyLoss = Math.abs(Math.min(0, todayPnl + floatingPnl));
  if (dailyLimit > 0) scores.push(Math.max(0, Math.min(100, ((dailyLimit - dailyLoss) / dailyLimit) * 100)));

  // Total loss safety
  const totalLimit = resolveLimit(rule.max_total_loss, rule.total_loss_type, rule.account_size);
  const totalLoss = Math.max(0, rule.account_size - equity);
  if (totalLimit > 0) scores.push(Math.max(0, Math.min(100, ((totalLimit - totalLoss) / totalLimit) * 100)));

  // Profit target progress
  const targetLimit = resolveLimit(rule.profit_target, rule.target_type, rule.account_size);
  const currentProfit = balance - rule.account_size;
  if (targetLimit > 0) scores.push(Math.max(0, Math.min(100, (currentProfit / targetLimit) * 100)));

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/objectives.ts
git commit -m "feat: add objectives calculation library with discipline score"
```

---

### Task 8: Objectives Tab Component

**Files:**
- Create: `app/components/live/ObjectivesTab.tsx`

- [ ] **Step 1: Create `app/components/live/ObjectivesTab.tsx`**

```typescript
'use client';

import { useMemo } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { LiveTrade, LiveAccountInfo, PropfirmRule, ObjectiveResult, ObjectiveStatus } from '../../lib/live-types';
import { calculateObjectives, calculateDisciplineScore } from '../../lib/objectives';

interface ObjectivesTabProps {
  rule: PropfirmRule;
  trades: LiveTrade[];
  account: LiveAccountInfo | null;
}

function StatusIcon({ status }: { status: ObjectiveStatus }) {
  if (status === 'passing') return <CheckCircle className="w-5 h-5 text-profit" />;
  if (status === 'failed') return <XCircle className="w-5 h-5 text-loss" />;
  return <Clock className="w-5 h-5 text-warning" />;
}

function ScoreGauge({ score }: { score: number }) {
  const rotation = (score / 100) * 180;
  const color = score >= 70 ? 'text-profit' : score >= 40 ? 'text-warning' : 'text-loss';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <div className="absolute inset-0 border-[8px] border-border rounded-t-full" />
        <div
          className={`absolute inset-0 border-[8px] border-transparent rounded-t-full ${color}`}
          style={{
            borderTopColor: 'currentColor',
            borderLeftColor: rotation > 90 ? 'currentColor' : 'transparent',
            borderRightColor: rotation <= 90 ? 'currentColor' : 'transparent',
            transform: `rotate(${rotation - 90}deg)`,
            transformOrigin: 'bottom center',
          }}
        />
      </div>
      <p className={`text-3xl font-bold font-mono ${color} -mt-2`}>{score}%</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Discipline Score</p>
    </div>
  );
}

export default function ObjectivesTab({ rule, trades, account }: ObjectivesTabProps) {
  const objectives = useMemo(() => calculateObjectives(rule, trades, account), [rule, trades, account]);
  const score = useMemo(() => calculateDisciplineScore(rule, trades, account), [rule, trades, account]);

  return (
    <div className="space-y-6 pt-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Discipline Score */}
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <ScoreGauge score={score} />
        </div>

        {/* Objectives Checklist */}
        <div className="bg-bg-secondary border border-border rounded-xl p-6 sm:col-span-2">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px] mb-4">Objectives</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Trading Objective</th>
                <th className="text-right text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Result</th>
                <th className="text-right text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Target</th>
                <th className="text-center text-[10px] text-text-muted uppercase tracking-wider font-medium pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {objectives.map((obj) => (
                <tr key={obj.name} className="border-t border-border/50">
                  <td className="py-3 text-sm text-text-primary">{obj.name}</td>
                  <td className="py-3 text-sm text-text-secondary font-mono text-right">{obj.result}</td>
                  <td className="py-3 text-sm text-text-muted font-mono text-right">{obj.target}</td>
                  <td className="py-3 text-center"><StatusIcon status={obj.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rule Info */}
      <div className="bg-bg-secondary border border-border rounded-xl p-4">
        <p className="text-xs text-text-muted">
          Rule Set: <span className="text-text-primary font-medium">{rule.name}</span>
          {' · '}Account Size: <span className="text-text-primary font-mono">${rule.account_size.toLocaleString()}</span>
          {' · '}Daily Loss Calc: <span className="text-text-primary">{rule.daily_loss_calc === 'balance' ? 'Balance-based' : 'Equity-based'}</span>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/live/ObjectivesTab.tsx
git commit -m "feat: add ObjectivesTab with checklist and discipline score gauge"
```

---

### Task 9: Wire Up Objectives Tab in Live Page

**Files:**
- Modify: `app/components/live/LiveTabs.tsx`
- Modify: `app/live/page.tsx`

- [ ] **Step 1: Update `app/components/live/LiveTabs.tsx`**

Make the tab list dynamic to conditionally include Objectives:

```typescript
'use client';

export type TabId = 'overview' | 'objectives' | 'trades' | 'calendar' | 'performance';

interface LiveTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  showObjectives?: boolean;
}

export default function LiveTabs({ activeTab, onTabChange, showObjectives = false }: LiveTabsProps) {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(showObjectives ? [{ id: 'objectives' as TabId, label: 'Objectives' }] : []),
    { id: 'trades', label: 'Trades' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'performance', label: 'Performance' },
  ];

  return (
    <div className="flex gap-0 border-b border-border">
      {tabs.map(tab => (
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
```

- [ ] **Step 2: Update `app/live/page.tsx`**

Add imports:
```typescript
import { PropfirmRule } from '../lib/live-types';
import ObjectivesTab from '../components/live/ObjectivesTab';
```

Update `getInitialTab` to include `objectives`:
```typescript
  if (['overview', 'objectives', 'trades', 'calendar', 'performance'].includes(hash)) return hash as TabId;
```

Add state for the rule and fetch it when account changes:
```typescript
  const [accountRule, setAccountRule] = useState<PropfirmRule | null>(null);
```

Add a useEffect to fetch rule data when accountId changes:
```typescript
  useEffect(() => {
    if (!accountId) { setAccountRule(null); return; }

    async function fetchRule() {
      try {
        // Find account id from accounts list
        const accountsRes = await fetch('/api/live/accounts');
        const accountsData = await accountsRes.json();
        const account = (accountsData.accounts ?? []).find((a: { slug: string }) => a.slug === accountId);
        if (!account?.rule_id) { setAccountRule(null); return; }

        const ruleRes = await fetch(`/api/live/rules/${account.rule_id}`);
        if (ruleRes.ok) {
          setAccountRule(await ruleRes.json());
        } else {
          setAccountRule(null);
        }
      } catch {
        setAccountRule(null);
      }
    }

    fetchRule();
  }, [accountId]);
```

Update `LiveTabs` to pass `showObjectives`:
```typescript
        <LiveTabs activeTab={activeTab} onTabChange={handleTabChange} showObjectives={!!accountRule} />
```

Add the Objectives tab rendering after Overview:
```typescript
      {activeTab === 'objectives' && accountRule && (
        <ObjectivesTab rule={accountRule} trades={liveData.history} account={liveData.account} />
      )}
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add app/components/live/LiveTabs.tsx app/live/page.tsx
git commit -m "feat: wire up conditional Objectives tab on live page"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 3: Rebuild Docker and deploy**

```bash
docker build -t metatrader-journal:latest .
docker rm -f trading
docker run -d --name trading --network development_lgu-network \
  -e MYSQL_HOST=lgu-mysql \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=DpCH7pisSoTNjOxApMbiDrpQc0obOLU \
  -e MYSQL_DATABASE=db_metatrader_journal \
  metatrader-journal:latest
```

- [ ] **Step 4: Manual end-to-end test**

1. Go to `/live/rules` — create an "FTMO Challenge 10k" rule set (account size: 10000, daily loss: 5%, total loss: 10%, profit target: 10%, min days: 4)
2. Go to `/live/settings` — edit the FTMO prop firm account, assign the rule set from dropdown
3. Go to `/live` — switch to the FTMO account
4. Verify "Objectives" tab appears between Overview and Trades
5. Click Objectives — verify discipline score gauge and objectives checklist
6. Switch to live account — verify Objectives tab is hidden
7. Go to `/live/rules` — edit/delete rules work correctly
