# Multi-Account Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to toggle between multiple MT5 accounts on the Live Trading dashboard via a dropdown selector, with accounts configured in a JSON file.

**Architecture:** Accounts are defined in `accounts.json` (Docker volume-mounted). A shared server-side helper reads the file and resolves account endpoints. Each existing API route gains an `accountId` query parameter. The frontend uses URL search params (`/live?account=<id>`) for account selection, with localStorage persistence for last-used account.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, lucide-react icons

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `accounts.json` | Account configuration: id, name, type, endpoint per account |
| `app/lib/accounts.ts` | Server-side helper: read `accounts.json`, resolve endpoint by account ID, env var fallback |
| `app/api/live/accounts/route.ts` | `GET /api/live/accounts` — returns account list with live connection status |
| `app/components/live/AccountSelector.tsx` | Client-side dropdown for switching accounts |

### Modified Files

| File | Change |
|------|--------|
| `app/lib/live-types.ts` | Add `AccountInfo` and `AccountListResponse` types |
| `app/api/live/account/route.ts` | Use shared resolver with `accountId` param |
| `app/api/live/positions/route.ts` | Use shared resolver with `accountId` param |
| `app/api/live/history/route.ts` | Use shared resolver with `accountId` param |
| `app/api/live/health/route.ts` | Use shared resolver with `accountId` param |
| `app/hooks/useLiveData.ts` | Accept `accountId` param, include in fetch URLs, reset on change |
| `app/live/page.tsx` | Add `AccountSelector`, read `accountId` from URL search params |
| `.gitignore` | Add `accounts.json` |
| `Dockerfile` | Copy `accounts.example.json` for reference |

---

### Task 1: Add Types and Account Configuration

**Files:**
- Create: `accounts.json`
- Create: `accounts.example.json`
- Modify: `app/lib/live-types.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create `accounts.json` at project root**

```json
{
  "accounts": [
    {
      "id": "live",
      "name": "Live Trading",
      "type": "live",
      "endpoint": "http://localhost:5555"
    }
  ]
}
```

- [ ] **Step 2: Create `accounts.example.json` at project root**

This is a checked-in example for reference. `accounts.json` itself is gitignored.

```json
{
  "accounts": [
    {
      "id": "live",
      "name": "Live Trading",
      "type": "live",
      "endpoint": "http://localhost:5555"
    },
    {
      "id": "propfirm-1",
      "name": "FTMO Challenge",
      "type": "propfirm",
      "endpoint": "http://localhost:5556"
    }
  ]
}
```

- [ ] **Step 3: Add `AccountConfig` and `AccountListItem` types to `app/lib/live-types.ts`**

Append to the end of the existing file:

```typescript
export interface AccountConfig {
  id: string;
  name: string;
  type: 'live' | 'propfirm';
  endpoint: string;
}

export interface AccountsFile {
  accounts: AccountConfig[];
}

export interface AccountListItem {
  id: string;
  name: string;
  type: 'live' | 'propfirm';
  status: LiveStatus;
  server: string | null;
  login: number | null;
}
```

- [ ] **Step 4: Add `accounts.json` to `.gitignore`**

Add to the end of `.gitignore`, under the `# tooling` section:

```
# account config (contains local endpoint URLs)
accounts.json
```

- [ ] **Step 5: Verify the build still passes**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add accounts.example.json app/lib/live-types.ts .gitignore
git commit -m "feat: add account config types and example config file"
```

---

### Task 2: Create Server-Side Account Resolver

**Files:**
- Create: `app/lib/accounts.ts`

- [ ] **Step 1: Create `app/lib/accounts.ts`**

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';
import { AccountConfig, AccountsFile } from './live-types';

const ACCOUNTS_PATH = join(process.cwd(), 'accounts.json');

export async function loadAccounts(): Promise<AccountConfig[]> {
  try {
    const raw = await readFile(ACCOUNTS_PATH, 'utf-8');
    const parsed: AccountsFile = JSON.parse(raw);
    if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
      return parsed.accounts;
    }
  } catch {
    // accounts.json missing or malformed — fall through to env var fallback
  }

  const envEndpoint = process.env.MT5_API_ENDPOINT ?? 'http://localhost:5555';
  return [{ id: 'default', name: 'MT5 Account', type: 'live', endpoint: envEndpoint }];
}

export async function resolveEndpoint(accountId: string | null): Promise<{ endpoint: string } | { error: string }> {
  const accounts = await loadAccounts();

  if (!accountId) {
    return { endpoint: accounts[0].endpoint };
  }

  const account = accounts.find((a) => a.id === accountId);
  if (!account) {
    return { error: `Account "${accountId}" not found` };
  }

  return { endpoint: account.endpoint };
}
```

- [ ] **Step 2: Verify the build still passes**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/lib/accounts.ts
git commit -m "feat: add server-side account resolver with env var fallback"
```

---

### Task 3: Update Existing API Routes to Use Account Resolver

**Files:**
- Modify: `app/api/live/account/route.ts`
- Modify: `app/api/live/positions/route.ts`
- Modify: `app/api/live/history/route.ts`
- Modify: `app/api/live/health/route.ts`

- [ ] **Step 1: Update `app/api/live/account/route.ts`**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { resolveEndpoint } from '../../../lib/accounts';

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('accountId');
  const resolved = await resolveEndpoint(accountId);

  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  try {
    const res = await fetch(`${resolved.endpoint}/account`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'MT5 account unavailable' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'MT5 unreachable' }, { status: 503 });
  }
}
```

- [ ] **Step 2: Update `app/api/live/positions/route.ts`**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { resolveEndpoint } from '../../../lib/accounts';

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('accountId');
  const resolved = await resolveEndpoint(accountId);

  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  try {
    const res = await fetch(`${resolved.endpoint}/positions`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'MT5 positions unavailable' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'MT5 unreachable' }, { status: 503 });
  }
}
```

- [ ] **Step 3: Update `app/api/live/history/route.ts`**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { resolveEndpoint } from '../../../lib/accounts';

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('accountId');
  const days = req.nextUrl.searchParams.get('days') ?? '90';
  const resolved = await resolveEndpoint(accountId);

  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  try {
    const res = await fetch(`${resolved.endpoint}/history?days=${days}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'MT5 history unavailable' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'MT5 unreachable' }, { status: 503 });
  }
}
```

- [ ] **Step 4: Update `app/api/live/health/route.ts`**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { resolveEndpoint } from '../../../lib/accounts';

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('accountId');
  const resolved = await resolveEndpoint(accountId);

  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  try {
    const res = await fetch(`${resolved.endpoint}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ status: 'offline' }, { status: 503 });
  }
}
```

- [ ] **Step 5: Verify the build still passes**

Run: `npm run build`
Expected: Build succeeds. Existing behavior is unchanged (no `accountId` param = use first account).

- [ ] **Step 6: Commit**

```bash
git add app/api/live/account/route.ts app/api/live/positions/route.ts app/api/live/history/route.ts app/api/live/health/route.ts
git commit -m "feat: update API routes to accept accountId parameter"
```

---

### Task 4: Create Accounts List Endpoint

**Files:**
- Create: `app/api/live/accounts/route.ts`

- [ ] **Step 1: Create `app/api/live/accounts/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { loadAccounts } from '../../../lib/accounts';
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
```

- [ ] **Step 2: Verify the build still passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Verify the endpoint works (manual test)**

Run: `npm run dev` and in another terminal:
```bash
curl http://localhost:3000/api/live/accounts
```
Expected: JSON response with the accounts array, each with `status`, `server`, `login` fields.

- [ ] **Step 4: Commit**

```bash
git add app/api/live/accounts/route.ts
git commit -m "feat: add /api/live/accounts endpoint with health status"
```

---

### Task 5: Update `useLiveData` Hook to Accept Account ID

**Files:**
- Modify: `app/hooks/useLiveData.ts`

- [ ] **Step 1: Update `app/hooks/useLiveData.ts`**

Replace the entire file with:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { LiveDataState, LiveAccountInfo, LivePosition, LiveTrade } from '../lib/live-types';

const POLL_INTERVAL = 5_000;

export function useLiveData(accountId: string | null, historyDays = 90): LiveDataState {
  const [state, setState] = useState<LiveDataState>({
    status: 'connecting',
    account: null,
    positions: [],
    history: [],
    lastUpdated: null,
    error: null,
  });

  const abortRef    = useRef<AbortController | null>(null);
  const lastHistory = useRef<LiveTrade[]>([]);

  useEffect(() => {
    // Reset state when account changes
    setState({
      status: 'connecting',
      account: null,
      positions: [],
      history: [],
      lastUpdated: null,
      error: null,
    });
    lastHistory.current = [];

    if (!accountId) return;

    let liveTimeout: ReturnType<typeof setTimeout>;

    async function pollLive() {
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      const q = `accountId=${encodeURIComponent(accountId!)}`;

      try {
        const [healthRes, accountRes, positionsRes, historyRes] = await Promise.all([
          fetch(`/api/live/health?${q}`,    { signal }),
          fetch(`/api/live/account?${q}`,   { signal }),
          fetch(`/api/live/positions?${q}`, { signal }),
          fetch(`/api/live/history?${q}&days=${historyDays}`, { signal }),
        ]);

        if (signal.aborted) return;

        if (!healthRes.ok) {
          setState(prev => ({ ...prev, status: 'offline', error: 'MT5 disconnected' }));
          schedule();
          return;
        }

        const account: LiveAccountInfo | null = accountRes.ok ? await accountRes.json() : null;
        const positions: LivePosition[]       = positionsRes.ok ? await positionsRes.json() : [];

        let history = lastHistory.current;
        if (historyRes.ok) {
          history = await historyRes.json();
          lastHistory.current = history;
        }

        setState(prev => ({
          ...prev,
          status: 'online',
          account,
          positions,
          history,
          lastUpdated: new Date(),
          error: null,
        }));
      } catch (err) {
        if (signal.aborted) return;
        setState(prev => ({
          ...prev,
          status: 'offline',
          error: err instanceof Error ? err.message : 'Connection failed',
        }));
      }

      schedule();
    }

    function schedule() {
      liveTimeout = setTimeout(pollLive, POLL_INTERVAL);
    }

    pollLive();

    return () => {
      clearTimeout(liveTimeout);
      abortRef.current?.abort();
    };
  }, [accountId, historyDays]);

  return state;
}
```

- [ ] **Step 2: Verify the build still passes**

Run: `npm run build`
Expected: Build will fail because `app/live/page.tsx` still calls `useLiveData(historyDays)` with the old signature. This is expected — we fix it in Task 7.

- [ ] **Step 3: Commit**

```bash
git add app/hooks/useLiveData.ts
git commit -m "feat: update useLiveData hook to accept accountId parameter"
```

---

### Task 6: Create Account Selector Component

**Files:**
- Create: `app/components/live/AccountSelector.tsx`

- [ ] **Step 1: Create `app/components/live/AccountSelector.tsx`**

```typescript
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
```

- [ ] **Step 2: Verify the build still passes**

Run: `npm run build`
Expected: Build succeeds (component is not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add app/components/live/AccountSelector.tsx
git commit -m "feat: add AccountSelector dropdown component"
```

---

### Task 7: Wire Up Live Page with Account Switching

**Files:**
- Modify: `app/live/page.tsx`
- Modify: `app/live/layout.tsx`

- [ ] **Step 1: Update `app/live/page.tsx`**

Replace the entire file with:

```typescript
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

  // Resolve account ID on mount: URL param > localStorage > first account
  useEffect(() => {
    const urlAccount = searchParams.get('account');
    if (urlAccount) {
      setAccountId(urlAccount);
      localStorage.setItem(LS_KEY, urlAccount);
    } else {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        setAccountId(stored);
        router.replace(`/live?account=${encodeURIComponent(stored)}`);
      } else {
        // Fetch accounts to get the first one
        fetch('/api/live/accounts')
          .then((r) => r.json())
          .then((data) => {
            if (data.accounts?.length > 0) {
              const firstId = data.accounts[0].id;
              setAccountId(firstId);
              localStorage.setItem(LS_KEY, firstId);
              router.replace(`/live?account=${encodeURIComponent(firstId)}`);
            }
          })
          .catch(() => {
            // fallback — useLiveData will handle null accountId
          });
      }
    }
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectAccount = useCallback(
    (id: string) => {
      setAccountId(id);
      localStorage.setItem(LS_KEY, id);
      router.replace(`/live?account=${encodeURIComponent(id)}`);
    },
    [router]
  );

  const liveData = useLiveData(accountId, historyDays);

  if (!ready) return null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <AccountSelector selectedId={accountId} onSelect={handleSelectAccount} />
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
Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
1. Open `http://localhost:3000/live` — should redirect to `/live?account=live` (or whatever the first account ID is)
2. Dropdown should show configured accounts with status dots
3. Selecting a different account should update the URL and reload data
4. Refreshing the page should remember the last selected account

- [ ] **Step 4: Commit**

```bash
git add app/live/page.tsx
git commit -m "feat: wire up account switching on live page"
```

---

### Task 8: Docker and Deployment Configuration

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Add `accounts.example.json` copy to `Dockerfile`**

In the `Dockerfile`, in the runner stage (after the `COPY --from=builder` lines, before `USER nextjs`), add:

```dockerfile
COPY accounts.example.json ./accounts.example.json
```

This gives users a reference template inside the container. The actual `accounts.json` should be volume-mounted at runtime.

Full runner stage becomes:

```dockerfile
# ─── Production ──────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV MT5_API_ENDPOINT=http://host.docker.internal:5555

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY accounts.example.json ./accounts.example.json

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

- [ ] **Step 2: Verify Docker build succeeds**

Run: `docker build -t metatrader-journal .`
Expected: Build completes successfully.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "chore: copy accounts example into Docker image for reference"
```

---

### Task 9: Handle Edge Cases

**Files:**
- Modify: `app/live/page.tsx`

- [ ] **Step 1: Handle stale account ID in `LivePageContent`**

In `app/live/page.tsx`, update the `useEffect` that resolves the account to also validate against the accounts list. Replace the existing `useEffect` (the one that resolves account ID on mount) with:

```typescript
  useEffect(() => {
    async function resolveAccount() {
      const urlAccount = searchParams.get('account');

      // Fetch available accounts for validation
      let availableIds: string[] = [];
      try {
        const res = await fetch('/api/live/accounts');
        const data = await res.json();
        availableIds = (data.accounts ?? []).map((a: { id: string }) => a.id);
      } catch {
        // If we can't fetch accounts, accept any ID
      }

      if (urlAccount && (availableIds.length === 0 || availableIds.includes(urlAccount))) {
        setAccountId(urlAccount);
        localStorage.setItem(LS_KEY, urlAccount);
      } else {
        const stored = localStorage.getItem(LS_KEY);
        if (stored && (availableIds.length === 0 || availableIds.includes(stored))) {
          setAccountId(stored);
          router.replace(`/live?account=${encodeURIComponent(stored)}`);
        } else if (availableIds.length > 0) {
          const firstId = availableIds[0];
          setAccountId(firstId);
          localStorage.setItem(LS_KEY, firstId);
          router.replace(`/live?account=${encodeURIComponent(firstId)}`);
        }
      }
      setReady(true);
    }

    resolveAccount();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
```

This handles:
- URL has an account ID that no longer exists in config → redirects to first available
- localStorage has a stale account ID → falls back to first available
- No accounts configured and no env var → `accountId` stays null, `useLiveData` shows connecting state

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/live/page.tsx
git commit -m "fix: validate account ID against available accounts on page load"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: Build succeeds with no errors or warnings.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 3: Manual end-to-end test**

Run: `npm run dev` and verify:

1. `/live` with no query param → redirects to `/live?account=<first-account-id>`
2. Dropdown shows all accounts from `accounts.json` with correct status dots
3. Switching accounts in dropdown → URL updates, data reloads, dashboard shows new account data
4. Refresh page → same account selected (localStorage persistence)
5. Delete `accounts.json` → app falls back to `MT5_API_ENDPOINT` env var, dropdown shows "MT5 Account"
6. Set URL to `/live?account=nonexistent` → redirects to first available account

- [ ] **Step 4: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: multi-account switching complete"
```
