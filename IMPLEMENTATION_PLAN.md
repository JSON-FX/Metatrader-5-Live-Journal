# MetaTrader Journal + MCP Live Integration

## Implementation Plan

**Date:** 2026-03-28
**Target repo:** /Users/jsonse/documents/development/metatrader-journal
**MCP reference:** github.com/chymian/metatrader-mcp

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Mac (dev machine)                                                  │
│                                                                     │
│  ┌────────────────────┐     stdio      ┌──────────────────────┐    │
│  │  Claude Code / AI  │◄──────────────►│  metatrader-mcp      │    │
│  │  (MCP client)      │                │  (Node.js MCP server)│    │
│  └────────────────────┘                │  MT5_API_ENDPOINT    │    │
│                                        │  → localhost:5555    │    │
│  ┌─────────────────────────────────────┤  → localhost:5556    │    │
│  │  Next.js Trading Journal            └──────────┬───────────┘    │
│  │  (browser, port 3000)                          │ HTTP           │
│  │                                                │                │
│  │  ┌──────────────────────────────┐   SSH tunnel (per account)    │
│  │  │  /api/live/[account]/* routes│   5555 → live account        │
│  │  │  (Next.js Route Handlers)    │   5556 → prop firm account   │
│  │  └──────────────────────────────┘              │                │
│  └─────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
                          │ ssh -N -L 5555:127.0.0.1:5555 vps-user@VPS_IP
                          │ ssh -N -L 5556:127.0.0.1:5556 vps-user@VPS_IP
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Windows VPS                                                        │
│                                                                     │
│  mt5_api.py (port 5555)         mt5_api.py (port 5556)             │
│  MT5_LOGIN=live_account         MT5_LOGIN=propfirm_account         │
│  MT5_PATH=IC Markets\...        MT5_PATH=PropFirm\...              │
│       │ shared memory                │ shared memory               │
│       ▼                              ▼                             │
│  ┌──────────────────────┐   ┌──────────────────────┐              │
│  │  MT5 Terminal #1     │   │  MT5 Terminal #2     │              │
│  │  (live account)      │   │  (prop firm account) │              │
│  └──────────────────────┘   └──────────────────────┘              │
│                                                                     │
│  NOTE: MetaTrader5 Python lib uses shared memory — each bridge     │
│  instance must target its specific terminal via MT5_LOGIN +        │
│  MT5_PATH environment variables.                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 — VPS Python Flask Bridge

### Objective
Create `mt5_api.py` — a single Python Flask script that can serve any MT5 terminal
on the VPS. Run one instance per account, each on a different port, targeted to a
specific terminal via environment variables.

**File location in this repo:** `vps-bridge/mt5_api.py` (copy to VPS to deploy)

### 1.1 Prerequisites on VPS

1. Install Python 3.10+ for Windows on the VPS
2. Install required packages:
   ```
   pip install MetaTrader5 Flask flask-cors
   ```
3. Ensure each MT5 terminal is running and logged in before starting its bridge.
   The MetaTrader5 Python library connects via shared memory — it cannot start
   the terminal remotely.

### 1.2 How Multi-Terminal Targeting Works

The bridge uses environment variables to pin itself to a specific terminal:

| Variable | Purpose | Example |
|----------|---------|---------|
| `MT5_LOGIN` | Account number — uniquely identifies which terminal to connect to | `12345678` |
| `MT5_PATH` | Path to `terminal64.exe` — required when multiple installations exist | `C:\Program Files\MetaTrader 5 (IC Markets)\terminal64.exe` |
| `MT5_PASSWORD` | Account password (optional if already logged in) | `yourpass` |
| `MT5_SERVER` | Broker server name (optional if already logged in) | `ICMarketsSC-MT5-2` |
| `FLASK_PORT` | Port this instance listens on | `5555` |

When `MT5_LOGIN` is set, the Python library finds the terminal running that specific
account — even if multiple MT5 terminals are open simultaneously.

### 1.3 File: `vps-bridge/mt5_api.py`

See the actual file at `vps-bridge/mt5_api.py` in this repo.

### 1.4 Startup Scripts (one per account)

**`vps-bridge/start_live.bat`** — live trading account
```bat
@echo off
cd /d %~dp0
set MT5_LOGIN=YOUR_LIVE_ACCOUNT_NUMBER
set MT5_PATH=C:\Program Files\MetaTrader 5 (IC Markets)\terminal64.exe
set MT5_SERVER=ICMarketsSC-MT5-2
set FLASK_PORT=5555
python mt5_api.py
```

**`vps-bridge/start_propfirm.bat`** — prop firm challenge account
```bat
@echo off
cd /d %~dp0
set MT5_LOGIN=YOUR_PROPFIRM_ACCOUNT_NUMBER
set MT5_PATH=C:\Program Files\MetaTrader 5 (PropFirm)\terminal64.exe
set MT5_SERVER=YourPropFirmServer
set FLASK_PORT=5556
python mt5_api.py
```

Configure both via Windows Task Scheduler — trigger: "At log on", with a 30s
delay to allow MT5 terminals to fully initialize first.

### 1.5 Testing on VPS

After starting a bridge, test it locally on the VPS:
```bat
curl http://localhost:5555/health
curl http://localhost:5555/account
curl http://localhost:5555/positions
```

---

## Phase 2 — VPS Connectivity (SSH Tunnel)

### 2.1 Recommended: SSH Tunnel

The Flask bridge binds to `127.0.0.1:5555` (localhost only). The Mac accesses it
via an SSH tunnel that forwards local port 5555 to the VPS.

**One-shot tunnel (testing — both accounts at once):**
```bash
# Forwards both ports in a single SSH connection
ssh -N \
  -L 5555:127.0.0.1:5555 \
  -L 5556:127.0.0.1:5556 \
  vps-user@<VPS_IP>
```

**Persistent tunnel using autossh:**
```bash
brew install autossh

autossh -M 0 -f -N \
  -o "ServerAliveInterval=30" \
  -o "ServerAliveCountMax=3" \
  -L 5555:127.0.0.1:5555 \
  -L 5556:127.0.0.1:5556 \
  vps-user@<VPS_IP>
```

**Launchd plist for persistent tunnel on Mac:**

Create `/Library/LaunchAgents/com.jsonfx.mt5tunnel.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>       <string>com.jsonfx.mt5tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/autossh</string>
    <string>-M</string><string>0</string>
    <string>-N</string>
    <string>-o</string><string>ServerAliveInterval=30</string>
    <string>-o</string><string>ServerAliveCountMax=3</string>
    <string>-L</string><string>5555:127.0.0.1:5555</string>
    <string>-L</string><string>5556:127.0.0.1:5556</string>
    <string>vps-user@YOUR_VPS_IP</string>
  </array>
  <key>RunAtLoad</key>   <true/>
  <key>KeepAlive</key>   <true/>
</dict>
</plist>
```
Load with: `launchctl load /Library/LaunchAgents/com.jsonfx.mt5tunnel.plist`

### 2.2 Security Considerations

- **Use SSH tunnel** — keeps Flask bridge completely off the public internet
- **SSH key auth only** — disable password auth on VPS (`PasswordAuthentication no`)
- **Dedicated SSH key** for the tunnel:
  `ssh-keygen -t ed25519 -C "mt5-tunnel" -f ~/.ssh/mt5_tunnel`
- **CORS restriction** — Flask allows only `http://localhost:3000`
- **No API token needed** — the tunnel itself is the auth layer
- **Never commit VPS IP or credentials** — store in `.env.local` (gitignored)

---

## Phase 3 — MCP Server Setup on Mac

### 3.1 Install metatrader-mcp

```bash
git clone https://github.com/chymian/metatrader-mcp ~/tools/metatrader-mcp
cd ~/tools/metatrader-mcp
npm install
npm run build
```

### 3.2 Configure in Claude Code

Use the `/update-config` skill in Claude Code to add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "metatrader": {
      "command": "node",
      "args": ["/Users/<user>/tools/metatrader-mcp/server.js"],
      "env": {
        "MT5_API_ENDPOINT": "http://localhost:5555",
        "MT5_API_KEY": ""
      },
      "disabled": false,
      "autoApprove": [
        "get_account_info",
        "get_open_positions",
        "get_pending_orders",
        "get_symbol_price"
      ]
    }
  }
}
```

`autoApprove` covers read-only tools only. `create_order`, `close_position`,
`modify_order`, `delete_order` require explicit approval every time.

### 3.3 Verify

With tunnel active and Flask bridge running:
```bash
curl http://localhost:5555/health
curl http://localhost:5555/account
curl http://localhost:5555/positions
```
Then ask Claude Code: "What is my current MT5 account balance?"

---

## Phase 4 — Journal Integration (Next.js)

### 4.1 New Files to Create

```
metatrader-journal/
├── .env.local                               # API endpoints (gitignored)
├── vps-bridge/                              # Copy these files to VPS
│   ├── mt5_api.py                           # The Flask bridge script
│   ├── start_live.bat                       # Launcher for live account
│   └── start_propfirm.bat                   # Launcher for prop firm account
├── app/
│   ├── api/
│   │   └── live/
│   │       ├── [account]/
│   │       │   ├── account/route.ts         # Proxy → :5555 or :5556/account
│   │       │   ├── positions/route.ts       # Proxy → :5555 or :5556/positions
│   │       │   └── health/route.ts          # Proxy → :5555 or :5556/health
│   ├── components/
│   │   ├── LiveAccountPanel.tsx             # Balance/equity/drawdown panel
│   │   ├── OpenPositionsPanel.tsx           # Open positions table
│   │   └── AccountSelector.tsx             # Switch between live/propfirm
│   ├── hooks/
│   │   └── useLiveData.ts                   # Polling hook (10s interval)
│   └── lib/
│       └── live-types.ts                    # TypeScript types for live API
```

### 4.2 New TypeScript Types

**`app/lib/live-types.ts`**

```typescript
export interface LiveAccountInfo {
  login: number;
  name: string;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  margin_level: number;
  floating_pnl: number;
  drawdown_pct: number;
  leverage: number;
  profit: number;
  timestamp: string;
}

export interface LivePosition {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  open_price: number;
  current_price: number;
  sl: number | null;
  tp: number | null;
  profit: number;
  swap: number;
  commission: number;
  open_time: string;
  comment: string;
  magic: number;
}

export interface LiveDataState {
  account: LiveAccountInfo | null;
  positions: LivePosition[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}
```

### 4.3 Next.js API Proxy Routes

The browser cannot directly call `localhost:5555` (SSH tunnel is on the Mac, not
in the browser). Next.js API routes run server-side on the Mac and can reach it.

**`app/api/live/account/route.ts`**

```typescript
import { NextResponse } from 'next/server';

const MT5_API = process.env.MT5_API_ENDPOINT ?? 'http://localhost:5555';

export async function GET() {
  try {
    const res = await fetch(`${MT5_API}/account`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: 'MT5 bridge error', status: res.status },
        { status: res.status }
      );
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { error: 'MT5 bridge unreachable. Is the SSH tunnel active?' },
      { status: 503 }
    );
  }
}
```

**`app/api/live/positions/route.ts`** — same pattern, fetches `${MT5_API}/positions`

**`app/api/live/health/route.ts`** — same pattern, fetches `${MT5_API}/health`

### 4.4 Custom Hook for Polling

**`app/hooks/useLiveData.ts`**

```typescript
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { LiveDataState } from '../lib/live-types';

const POLL_INTERVAL_MS = 10_000; // 10s — safe polling rate for MT5

export function useLiveData(enabled: boolean = true) {
  const [state, setState] = useState<LiveDataState>({
    account: null,
    positions: [],
    isConnected: false,
    isLoading: false,
    error: null,
    lastUpdated: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveData = useCallback(async () => {
    if (!enabled) return;
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const [accountRes, positionsRes] = await Promise.all([
        fetch('/api/live/account'),
        fetch('/api/live/positions'),
      ]);
      if (!accountRes.ok || !positionsRes.ok) {
        throw new Error('Bridge returned error status');
      }
      const [account, positions] = await Promise.all([
        accountRes.json(),
        positionsRes.json(),
      ]);
      setState({
        account,
        positions,
        isConnected: true,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        isConnected: false,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      }));
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchLiveData();
    intervalRef.current = setInterval(fetchLiveData, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, fetchLiveData]);

  return { ...state, refresh: fetchLiveData };
}
```

### 4.5 LiveAccountPanel Component

**`app/components/LiveAccountPanel.tsx`**

Follows `ReportStats.tsx` card conventions: `bg-zinc-900 rounded-xl border
border-zinc-800`. Shows balance, equity, floating P/L, and a drawdown progress bar.
Displays an "Offline" state with a retry button when the bridge is unreachable.

Key props: `liveData: LiveDataState`, `onRefresh: () => void`

UI states:
- **Offline** — grey `WifiOff` badge, error message, "Retry connection" link
- **Loading** — spinning `RefreshCw` icon in header
- **Connected** — 3-column metric grid (Balance / Equity / Floating P/L) +
  orange drawdown bar if drawdown > 0 + "Updated HH:MM:SS" footer

Color conventions matching existing codebase:
- Profit values: `text-emerald-500`
- Loss values: `text-red-500`
- Live badge: `bg-emerald-500/20 text-emerald-400`
- Drawdown bar: `bg-orange-500`

### 4.6 OpenPositionsPanel Component

**`app/components/OpenPositionsPanel.tsx`**

Follows `TradesTable.tsx` table conventions: `overflow-x-auto` wrapper, `divide-y
divide-zinc-800` rows, `hover:bg-zinc-800/50` row hover.

Columns: Symbol | Type (BUY/SELL badge) | Volume | Open Price | Current Price |
P/L | SL | TP

Header shows total floating P/L across all positions.
Empty state: "No open positions" message.
Only renders when `isConnected` is true.

### 4.7 Live Balance Overlay in EquityChart

Modify `app/components/EquityChart.tsx`:

Add optional `liveBalance?: number | null` prop. When provided, render a
`<ReferenceLine>` at that balance value using recharts:

```typescript
// Change AreaChart → ComposedChart (drop-in, all Area children still work)
import { ComposedChart } from 'recharts';

// Add ReferenceLine for live balance
{liveBalance != null && (
  <ReferenceLine
    y={liveBalance}
    stroke="#60a5fa"
    strokeDasharray="8 4"
    strokeWidth={1.5}
    label={{
      value: `Live: $${liveBalance.toLocaleString()}`,
      fill: '#60a5fa',
      fontSize: 11,
      position: 'right'
    }}
  />
)}
```

### 4.8 Integration in page.tsx

```typescript
// New imports
import { useLiveData } from './hooks/useLiveData';
import LiveAccountPanel from './components/LiveAccountPanel';
import OpenPositionsPanel from './components/OpenPositionsPanel';

// Inside Home() — add hook
const liveData = useLiveData(true);

// In JSX — add live section above the reports grid
<section className="mb-6">
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <div className="lg:col-span-1">
      <LiveAccountPanel liveData={liveData} onRefresh={liveData.refresh} />
    </div>
    <div className="lg:col-span-2">
      <OpenPositionsPanel
        positions={liveData.positions}
        isConnected={liveData.isConnected}
      />
    </div>
  </div>
</section>

// Pass liveBalance into EquityChart
<EquityChart
  report={selectedReport}
  liveBalance={liveData.account?.balance ?? null}
/>
```

---

## Phase 5 — Environment Configuration

**`.env.local`** (create in `metatrader-journal/`, never commit):

```env
MT5_API_ENDPOINT=http://localhost:5555
```

Verify `.gitignore` already includes `.env.local` (Next.js default does).

---

## Implementation Sequence

Build in this order to catch issues early:

1. **VPS** — Write `mt5_api.py`, test with `curl localhost:5555/account` on VPS
2. **Tunnel** — SSH tunnel from Mac, verify `curl localhost:5555/account` from Mac
3. **MCP** — Install metatrader-mcp, configure Claude Code, verify "What's my MT5 balance?" works
4. **API routes** — Add `/app/api/live/` Next.js proxies, verify `curl localhost:3000/api/live/account`
5. **Types** — Add `live-types.ts`
6. **Hook** — Add `useLiveData.ts`
7. **LiveAccountPanel** — Build and wire into `page.tsx`, verify offline/online states
8. **OpenPositionsPanel** — Build and wire in, verify with real positions
9. **EquityChart overlay** — Add `liveBalance` prop and `ReferenceLine`

---

## Potential Challenges

| Challenge | Mitigation |
|-----------|------------|
| MT5 Python lib requires same Windows session | Start `mt5_api.py` after MT5 is fully loaded; use Task Scheduler with 30s delay |
| `mt5.initialize()` fails if terminal restarts | Call `mt5.shutdown()` then `mt5.initialize()` in `ensure_connected()` |
| SSH tunnel drops | Use autossh + launchd for auto-reconnect; journal shows "Offline" gracefully |
| Browser cannot reach `localhost:5555` | Next.js API proxy routes handle this — browser only calls `/api/live/*` |
| `AreaChart` → `ComposedChart` migration | Drop-in replacement; all `<Area>` children work unchanged |
| Polling rate vs MT5 load | 10s interval is safe; MT5 Python lib is designed for programmatic access |
