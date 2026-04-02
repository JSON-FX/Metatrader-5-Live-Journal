# Settings Page & MySQL Account Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the file-based `accounts.json` with a MySQL-backed settings page at `/live/settings` for managing MT5 account configurations.

**Architecture:** A MySQL database (`db_metatrader_journal`) stores account configurations. The existing `loadAccounts()` and `resolveEndpoint()` functions switch from file I/O to MySQL queries. A new settings page provides CRUD UI for accounts. The existing live dashboard and account selector continue to work unchanged — only the data source changes.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, mysql2/promise, lucide-react

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `app/lib/db.ts` | MySQL connection pool, database/table initialization |
| `app/api/live/accounts/[id]/route.ts` | PUT and DELETE handlers for individual accounts |
| `app/live/settings/page.tsx` | Settings page — account list + add/edit form |
| `app/components/live/AccountForm.tsx` | Inline form for creating/editing an account |
| `app/components/live/AccountList.tsx` | Table of configured accounts with actions |

### Modified Files

| File | Change |
|------|--------|
| `package.json` | Add `mysql2` dependency |
| `app/lib/live-types.ts` | Update `AccountConfig` to use `slug`, add `AccountRow` type |
| `app/lib/accounts.ts` | Replace file I/O with MySQL queries |
| `app/api/live/accounts/route.ts` | Add POST handler, update GET to use new `loadAccounts()` |
| `app/live/page.tsx` | Add gear icon link to `/live/settings` |
| `app/components/live/AccountSelector.tsx` | Handle empty state with link to settings |
| `Dockerfile` | Remove `COPY accounts.example.json`, remove `MT5_API_ENDPOINT` from runner |

### Files to Remove

| File | Reason |
|------|--------|
| `accounts.example.json` | Replaced by database |

---

### Task 1: Install mysql2 and Create Database Connection

**Files:**
- Modify: `package.json`
- Create: `app/lib/db.ts`

- [ ] **Step 1: Install mysql2**

```bash
npm install mysql2
```

- [ ] **Step 2: Create `app/lib/db.ts`**

```typescript
import mysql, { Pool } from 'mysql2/promise';

let pool: Pool | null = null;
let initialized = false;

function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST ?? 'lgu-mysql',
      user: process.env.MYSQL_USER ?? 'root',
      password: process.env.MYSQL_PASSWORD ?? '',
      database: process.env.MYSQL_DATABASE ?? 'db_metatrader_journal',
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
}

async function ensureDatabase(): Promise<void> {
  if (initialized) return;

  const dbName = process.env.MYSQL_DATABASE ?? 'db_metatrader_journal';

  // Connect without database to create it if needed
  const tempConn = await mysql.createConnection({
    host: process.env.MYSQL_HOST ?? 'lgu-mysql',
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
  });

  await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await tempConn.end();

  // Now create table using the pool (which targets the database)
  const p = getPool();
  await p.execute(`
    CREATE TABLE IF NOT EXISTS mt5_accounts (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      slug        VARCHAR(50) UNIQUE NOT NULL,
      name        VARCHAR(100) NOT NULL,
      type        ENUM('live', 'propfirm') NOT NULL DEFAULT 'live',
      endpoint    VARCHAR(255) NOT NULL,
      sort_order  INT NOT NULL DEFAULT 0,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  initialized = true;
}

export async function getDb(): Promise<Pool> {
  await ensureDatabase();
  return getPool();
}
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app/lib/db.ts
git commit -m "feat: add mysql2 and database connection with auto-initialization"
```

---

### Task 2: Update Types for MySQL-Backed Accounts

**Files:**
- Modify: `app/lib/live-types.ts`

- [ ] **Step 1: Update `AccountConfig` and add `AccountRow` in `app/lib/live-types.ts`**

Replace the existing `AccountConfig`, `AccountsFile`, and `AccountListItem` interfaces (lines 62-80) with:

```typescript
export interface AccountConfig {
  id: number;
  slug: string;
  name: string;
  type: 'live' | 'propfirm';
  endpoint: string;
  sort_order: number;
}

export interface AccountListItem {
  id: number;
  slug: string;
  name: string;
  type: 'live' | 'propfirm';
  status: LiveStatus;
  server: string | null;
  login: number | null;
}
```

Remove the `AccountsFile` interface entirely — it was for the JSON file format.

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build may fail due to references to `AccountsFile` or `account.id` vs `account.slug` in other files. That's expected — we fix those in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add app/lib/live-types.ts
git commit -m "feat: update account types for MySQL schema with slug field"
```

---

### Task 3: Rewrite Account Resolver to Use MySQL

**Files:**
- Modify: `app/lib/accounts.ts`

- [ ] **Step 1: Replace `app/lib/accounts.ts` entirely**

```typescript
import { getDb } from './db';
import { AccountConfig } from './live-types';
import { RowDataPacket } from 'mysql2';

export async function loadAccounts(): Promise<AccountConfig[]> {
  try {
    const db = await getDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, slug, name, type, endpoint, sort_order FROM mt5_accounts ORDER BY sort_order ASC, id ASC'
    );
    return rows as AccountConfig[];
  } catch {
    return [];
  }
}

export async function resolveEndpoint(slug: string | null): Promise<{ endpoint: string } | { error: string }> {
  if (!slug) {
    const accounts = await loadAccounts();
    if (accounts.length === 0) {
      return { error: 'No accounts configured' };
    }
    return { endpoint: accounts[0].endpoint };
  }

  try {
    const db = await getDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT endpoint FROM mt5_accounts WHERE slug = ?',
      [slug]
    );
    if (rows.length === 0) {
      return { error: `Account "${slug}" not found` };
    }
    return { endpoint: (rows[0] as { endpoint: string }).endpoint };
  } catch {
    return { error: 'Database connection failed' };
  }
}

export async function getAccountById(id: number): Promise<AccountConfig | null> {
  try {
    const db = await getDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, slug, name, type, endpoint, sort_order FROM mt5_accounts WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as AccountConfig) : null;
  } catch {
    return null;
  }
}

export async function createAccount(data: { slug: string; name: string; type: string; endpoint: string }): Promise<AccountConfig> {
  const db = await getDb();
  const [result] = await db.execute(
    'INSERT INTO mt5_accounts (slug, name, type, endpoint) VALUES (?, ?, ?, ?)',
    [data.slug, data.name, data.type, data.endpoint]
  );
  const insertId = (result as { insertId: number }).insertId;
  return (await getAccountById(insertId))!;
}

export async function updateAccount(id: number, data: { slug?: string; name?: string; type?: string; endpoint?: string }): Promise<AccountConfig | null> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
  if (data.endpoint !== undefined) { fields.push('endpoint = ?'); values.push(data.endpoint); }

  if (fields.length === 0) return getAccountById(id);

  values.push(id);
  const db = await getDb();
  await db.execute(`UPDATE mt5_accounts SET ${fields.join(', ')} WHERE id = ?`, values);
  return getAccountById(id);
}

export async function deleteAccount(id: number): Promise<boolean> {
  const db = await getDb();
  const [result] = await db.execute('DELETE FROM mt5_accounts WHERE id = ?', [id]);
  return (result as { affectedRows: number }).affectedRows > 0;
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build may still fail due to downstream files referencing `account.id` instead of `account.slug`. That's expected.

- [ ] **Step 3: Commit**

```bash
git add app/lib/accounts.ts
git commit -m "feat: rewrite account resolver to use MySQL instead of JSON file"
```

---

### Task 4: Update Accounts API Route (GET + POST)

**Files:**
- Modify: `app/api/live/accounts/route.ts`

- [ ] **Step 1: Replace `app/api/live/accounts/route.ts` entirely**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { loadAccounts, createAccount } from '../../../lib/accounts';
import { AccountListItem } from '../../../lib/live-types';

export async function GET() {
  const accounts = await loadAccounts();

  const results: AccountListItem[] = await Promise.all(
    accounts.map(async (account) => {
      try {
        const res = await fetch(`${account.endpoint}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const health = await res.json();
          return {
            id: account.id,
            slug: account.slug,
            name: account.name,
            type: account.type,
            status: 'online' as const,
            server: health.server ?? null,
            login: health.account ?? null,
          };
        }
      } catch {
        // offline — fall through
      }

      return {
        id: account.id,
        slug: account.slug,
        name: account.name,
        type: account.type,
        status: 'offline' as const,
        server: null,
        login: null,
      };
    })
  );

  return NextResponse.json({ accounts: results });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, name, type, endpoint } = body;

    if (!slug || !name || !endpoint) {
      return NextResponse.json({ error: 'slug, name, and endpoint are required' }, { status: 400 });
    }

    if (type && type !== 'live' && type !== 'propfirm') {
      return NextResponse.json({ error: 'type must be "live" or "propfirm"' }, { status: 400 });
    }

    const account = await createAccount({ slug, name, type: type ?? 'live', endpoint });
    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create account';
    if (message.includes('Duplicate entry')) {
      return NextResponse.json({ error: 'Account with this slug already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/live/accounts/route.ts
git commit -m "feat: add POST handler to accounts route for creating accounts"
```

---

### Task 5: Create Individual Account API Route (PUT + DELETE)

**Files:**
- Create: `app/api/live/accounts/[id]/route.ts`

- [ ] **Step 1: Create `app/api/live/accounts/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { updateAccount, deleteAccount, getAccountById } from '../../../../lib/accounts';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  const existing = await getAccountById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { slug, name, type, endpoint } = body;

    if (type && type !== 'live' && type !== 'propfirm') {
      return NextResponse.json({ error: 'type must be "live" or "propfirm"' }, { status: 400 });
    }

    const updated = await updateAccount(id, { slug, name, type, endpoint });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update account';
    if (message.includes('Duplicate entry')) {
      return NextResponse.json({ error: 'Account with this slug already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  const deleted = await deleteAccount(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/live/accounts/\[id\]/route.ts
git commit -m "feat: add PUT and DELETE routes for individual accounts"
```

---

### Task 6: Update AccountSelector for Empty State and Slug Field

**Files:**
- Modify: `app/components/live/AccountSelector.tsx`

- [ ] **Step 1: Replace `app/components/live/AccountSelector.tsx` entirely**

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import Link from 'next/link';
import { AccountListItem, LiveStatus } from '../../lib/live-types';

interface AccountSelectorProps {
  selectedId: string | null;
  onSelect: (accountSlug: string) => void;
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
    const interval = setInterval(fetchAccounts, 30_000);
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

  const selected = accounts.find((a) => a.slug === selectedId);

  if (accounts.length === 0) {
    return (
      <Link
        href="/live/settings"
        className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <Settings className="w-4 h-4" />
        No accounts — Configure
      </Link>
    );
  }

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
              key={account.slug}
              onClick={() => {
                onSelect(account.slug);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-bg-tertiary transition-colors border-l-2 ${
                account.slug === selectedId
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
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/components/live/AccountSelector.tsx
git commit -m "feat: add empty state to AccountSelector with link to settings"
```

---

### Task 7: Update Live Page (Slug References + Settings Link)

**Files:**
- Modify: `app/live/page.tsx`

- [ ] **Step 1: Update `app/live/page.tsx`**

Two changes needed:

1. Update the `resolveAccount` function to use `slug` instead of `id` when extracting available IDs from the accounts response.
2. Add a gear icon link to `/live/settings` next to the AccountSelector.

Replace the entire file with:

```typescript
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useLiveData } from '../hooks/useLiveData';
import LiveAccountPanel from '../components/live/LiveAccountPanel';
import OpenPositionsTable from '../components/live/OpenPositionsTable';
import LiveEquityChart from '../components/live/LiveEquityChart';
import LiveTradesTable from '../components/live/LiveTradesTable';
import AccountSelector from '../components/live/AccountSelector';

const LS_KEY = 'mt5-last-account';

function LivePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [historyDays, setHistoryDays] = useState(90);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function resolveAccount() {
      const urlAccount = searchParams.get('account');

      let availableSlugs: string[] = [];
      try {
        const res = await fetch('/api/live/accounts');
        const data = await res.json();
        availableSlugs = (data.accounts ?? []).map((a: { slug: string }) => a.slug);
      } catch {
        // If we can't fetch accounts, accept any ID
      }

      if (urlAccount && (availableSlugs.length === 0 || availableSlugs.includes(urlAccount))) {
        setAccountId(urlAccount);
        localStorage.setItem(LS_KEY, urlAccount);
      } else {
        const stored = localStorage.getItem(LS_KEY);
        if (stored && (availableSlugs.length === 0 || availableSlugs.includes(stored))) {
          setAccountId(stored);
          router.replace(`/live?account=${encodeURIComponent(stored)}`);
        } else if (availableSlugs.length > 0) {
          const firstSlug = availableSlugs[0];
          setAccountId(firstSlug);
          localStorage.setItem(LS_KEY, firstSlug);
          router.replace(`/live?account=${encodeURIComponent(firstSlug)}`);
        }
      }
      setReady(true);
    }

    resolveAccount();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectAccount = useCallback(
    (slug: string) => {
      setAccountId(slug);
      localStorage.setItem(LS_KEY, slug);
      router.replace(`/live?account=${encodeURIComponent(slug)}`);
    },
    [router]
  );

  const liveData = useLiveData(accountId, historyDays);

  if (!ready) return null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <AccountSelector selectedId={accountId} onSelect={handleSelectAccount} />
        <Link
          href="/live/settings"
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          title="Account Settings"
        >
          <Settings className="w-4.5 h-4.5" />
        </Link>
      </div>

      <LiveAccountPanel
        status={liveData.status}
        account={liveData.account}
        lastUpdated={liveData.lastUpdated}
        trades={liveData.history}
      />

      {liveData.status === 'online' && (
        <OpenPositionsTable positions={liveData.positions} />
      )}

      {liveData.status === 'online' && liveData.account && (
        <LiveEquityChart trades={liveData.history} balance={liveData.account.balance} />
      )}

      {liveData.status === 'online' && (
        <LiveTradesTable
          trades={liveData.history}
          historyDays={historyDays}
          onChangeDays={setHistoryDays}
        />
      )}
    </main>
  );
}

export default function LivePage() {
  return (
    <Suspense>
      <LivePageContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/live/page.tsx
git commit -m "feat: add settings link and update account references to use slug"
```

---

### Task 8: Create AccountForm Component

**Files:**
- Create: `app/components/live/AccountForm.tsx`

- [ ] **Step 1: Create `app/components/live/AccountForm.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';

interface AccountFormData {
  slug: string;
  name: string;
  type: 'live' | 'propfirm';
  endpoint: string;
}

interface AccountFormProps {
  initial?: AccountFormData;
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

export default function AccountForm({ initial, onSave, onCancel, saving, error }: AccountFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [type, setType] = useState<'live' | 'propfirm'>(initial?.type ?? 'live');
  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? '');
  const [slugTouched, setSlugTouched] = useState(!!initial);

  useEffect(() => {
    if (!slugTouched && !initial) {
      setSlug(toSlug(name));
    }
  }, [name, slugTouched, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({ slug, name, type, endpoint });
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
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/components/live/AccountForm.tsx
git commit -m "feat: add AccountForm component for creating/editing accounts"
```

---

### Task 9: Create AccountList Component

**Files:**
- Create: `app/components/live/AccountList.tsx`

- [ ] **Step 1: Create `app/components/live/AccountList.tsx`**

```typescript
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
                  <StatusBadge label={account.type === 'propfirm' ? 'Prop Firm' : 'Live'} variant={account.type === 'propfirm' ? 'backtest' : 'live'} />
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
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/components/live/AccountList.tsx
git commit -m "feat: add AccountList component with inline delete confirmation"
```

---

### Task 10: Create Settings Page

**Files:**
- Create: `app/live/settings/page.tsx`

- [ ] **Step 1: Create `app/live/settings/page.tsx`**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Server } from 'lucide-react';
import Link from 'next/link';
import { AccountListItem } from '../../lib/live-types';
import AccountForm from '../../components/live/AccountForm';
import AccountList from '../../components/live/AccountList';
import EmptyState from '../../components/shared/EmptyState';

type FormMode = { type: 'closed' } | { type: 'add' } | { type: 'edit'; account: AccountListItem };

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

  function handleEdit(account: AccountListItem) {
    setFormMode({ type: 'edit', account });
    setFormError(null);
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
            endpoint: '', // will be fetched fresh — not in AccountListItem
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
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/live/settings/page.tsx
git commit -m "feat: add settings page for managing MT5 accounts"
```

---

### Task 11: Update Settings Page to Fetch Endpoint for Editing

The `AccountListItem` type doesn't include `endpoint` (it's server-side only). When editing, the form needs the current endpoint value. We need to fetch the full account data from the database.

**Files:**
- Create: `app/api/live/accounts/[id]/detail/route.ts`
- Modify: `app/live/settings/page.tsx`

- [ ] **Step 1: Create `app/api/live/accounts/[id]/detail/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAccountById } from '../../../../../lib/accounts';

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

  return NextResponse.json(account);
}
```

- [ ] **Step 2: Update the edit handler in `app/live/settings/page.tsx`**

Replace the `handleEdit` function and update the `AccountForm` `initial` prop. Change the `FormMode` type and `handleEdit`:

Replace the `FormMode` type:

```typescript
type FormMode = { type: 'closed' } | { type: 'add' } | { type: 'edit'; account: AccountListItem; endpoint: string };
```

Replace the `handleEdit` function:

```typescript
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
```

Replace the `AccountForm` `initial` prop (inside the `formMode.type !== 'closed'` block):

```typescript
          initial={formMode.type === 'edit' ? {
            slug: formMode.account.slug,
            name: formMode.account.name,
            type: formMode.account.type,
            endpoint: formMode.endpoint,
          } : undefined}
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/api/live/accounts/\[id\]/detail/route.ts app/live/settings/page.tsx
git commit -m "feat: fetch full account details when editing"
```

---

### Task 12: Clean Up Old File-Based Artifacts

**Files:**
- Remove: `accounts.example.json`
- Remove: `accounts.json` (if exists)
- Modify: `Dockerfile`
- Modify: `app/lib/live-types.ts` (remove `AccountsFile`)

- [ ] **Step 1: Delete `accounts.example.json`**

```bash
git rm accounts.example.json
```

- [ ] **Step 2: Delete `accounts.json` if it exists (gitignored)**

```bash
rm -f accounts.json
```

- [ ] **Step 3: Update `Dockerfile`**

Remove the line `COPY accounts.example.json ./accounts.example.json` and remove `MT5_API_ENDPOINT` env vars from both builder and runner stages.

The full Dockerfile becomes:

```dockerfile
FROM node:22-alpine AS base

# ─── Dependencies ────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── Build ───────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ─── Production ──────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

- [ ] **Step 4: Remove `AccountsFile` from `app/lib/live-types.ts`**

Delete the `AccountsFile` interface if it still exists (it was used for the JSON file format).

- [ ] **Step 5: Remove `accounts.json` from `.gitignore`**

Remove these lines from `.gitignore`:

```
# account config (contains local endpoint URLs)
accounts.json
```

- [ ] **Step 6: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove file-based account config artifacts"
```

---

### Task 13: Final Verification

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors (pre-existing ones in unrelated files are OK).

- [ ] **Step 3: Rebuild Docker image**

```bash
docker build -t metatrader-journal:latest .
```

- [ ] **Step 4: Stop old container and start new one with MySQL env vars**

```bash
docker rm -f trading
docker run -d \
  --name trading \
  --network development_lgu-network \
  -e MYSQL_HOST=lgu-mysql \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=DpCH7pisSoTNjOxApMbiDrpQc0obOLU \
  -e MYSQL_DATABASE=db_metatrader_journal \
  metatrader-journal:latest
```

- [ ] **Step 5: Manual end-to-end test**

1. Open `/live` — should show "No accounts — Configure" link (no accounts in DB yet)
2. Click "Configure" → goes to `/live/settings`
3. Settings page shows empty state with "Add Account" button
4. Add a test account: Name="Live Trading", Endpoint="http://host.docker.internal:5555"
5. Account appears in the list with status dot
6. Go back to `/live` → dropdown shows "Live Trading"
7. Edit the account — form pre-fills with current values
8. Delete the account — inline confirmation works

- [ ] **Step 6: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: settings page and MySQL account storage complete"
```
