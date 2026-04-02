# Multi-Account Switching — Design Spec

## Overview

Add the ability to toggle between multiple MT5 accounts on the Live Trading dashboard. A dropdown selector in the page header lets the user switch which account's data is displayed. Accounts are configured via a `accounts.json` file mounted as a Docker volume.

## Motivation

The user runs multiple MT5 accounts on a single VPS (e.g., a live trading account and a prop firm challenge). The current implementation hardcodes a single `MT5_API_ENDPOINT`, limiting the dashboard to one account at a time.

## Architecture

### Approach: Query Parameter Routing

The selected account ID is stored as a URL query parameter (`/live?account=propfirm-1`). The `useLiveData` hook reads the selected account from the URL, resolves its endpoint from the config, and routes all API calls accordingly.

**Why this approach:**
- Shareable/bookmarkable links per account
- Browser back/forward works naturally
- No global state management needed
- Minimal changes to existing code

### Account Configuration

**File:** `accounts.json` at the project root.

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

**Fields:**
- `id` — unique identifier, used in URL query param and localStorage
- `name` — display name shown in the dropdown
- `type` — `"live"` or `"propfirm"` (for visual distinction, not functional difference)
- `endpoint` — the Flask bridge URL for this account

**Docker volume mount:** The file is mounted read-only into the container, not baked into the image. Edits on the host take effect on the next API request — no rebuild or restart needed.

```yaml
volumes:
  - ./accounts.json:/app/accounts.json:ro
```

**Backwards compatibility:** If `accounts.json` does not exist, the app falls back to reading `MT5_API_ENDPOINT` env var and treats it as a single unnamed account. This preserves the current behavior for existing setups.

## API Changes

### New Endpoint: `GET /api/live/accounts`

Returns the list of configured accounts with their live connection status.

**Response:**
```json
{
  "accounts": [
    {
      "id": "live",
      "name": "Live Trading",
      "type": "live",
      "status": "online",
      "server": "ICMarketsSC-MT5-2",
      "login": 12345678
    },
    {
      "id": "propfirm-1",
      "name": "FTMO Challenge",
      "type": "propfirm",
      "status": "offline",
      "server": null,
      "login": null
    }
  ]
}
```

The `server` and `login` fields are populated from each account's `/health` endpoint. They are `null` when the account is offline.

**Behavior:**
- Reads `accounts.json` from disk (no caching — allows live edits)
- Pings each account's `/health` endpoint in parallel to determine status
- Returns account metadata without exposing internal endpoints to the browser

### Modified Endpoints

All existing routes gain an `accountId` query parameter:

- `GET /api/live/account?accountId=propfirm-1`
- `GET /api/live/positions?accountId=propfirm-1`
- `GET /api/live/history?accountId=propfirm-1&days=90`
- `GET /api/live/health?accountId=propfirm-1`

**Resolution logic (shared helper):**
1. Read `accounts.json` from disk
2. Find account by `accountId`
3. If not found, return 404 `{ "error": "Account not found" }`
4. If `accountId` is omitted, use the first account in the list
5. Proxy the request to the account's `endpoint`

**Fallback:** If `accounts.json` doesn't exist, fall back to `MT5_API_ENDPOINT` env var (ignoring `accountId`).

## Frontend Changes

### Account Selector Component

**Location:** Rendered in `/app/live/page.tsx`, positioned in the page header next to the "Live Trading" title.

**Behavior:**
- On mount, fetches `GET /api/live/accounts` to populate the dropdown
- Each item shows: account name, status dot (green/red), server name + login number as subtitle
- Offline accounts are greyed out but still selectable
- Selecting an account updates the URL search param `?account=<id>` and saves to localStorage

**Account resolution on page load (priority order):**
1. `?account=` URL search param (if present and valid)
2. localStorage `last-selected-account` value (if valid)
3. First account in the list

### useLiveData Hook Changes

**Current signature:** `useLiveData()`
**New signature:** `useLiveData(accountId: string | null)`

- Includes `accountId` as a query parameter in all fetch calls
- Resets state (status → 'connecting', clears positions/history) when `accountId` changes
- Refetches immediately on account change (doesn't wait for next poll interval)

### URL Structure

- `/live` — redirects to `/live?account=<last-used-or-first>`
- `/live?account=live` — shows the "Live Trading" account
- `/live?account=propfirm-1` — shows the "FTMO Challenge" account

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `accounts.json` missing or malformed | Falls back to `MT5_API_ENDPOINT` env var. If neither exists, shows empty state with instructions. |
| Selected account removed from config | Redirects to first available account, clears stale localStorage value. |
| Account goes offline mid-session | Status badge switches to "Offline". Dashboard shows last known state. Handled by existing health check logic. |
| All accounts offline | Dropdown shows all accounts with red dots. Each shows offline state when selected. |
| Only one account configured | Dropdown renders with one item. No special single-account mode. |
| `/api/live/accounts` fetch fails | Dropdown shows loading/error state. Retries on next poll cycle. |

## Files to Create

| File | Purpose |
|------|---------|
| `accounts.json` | Account configuration (project root, Docker volume mounted) |
| `/app/lib/accounts.ts` | Shared helper: read `accounts.json`, resolve account by ID, fallback logic |
| `/app/api/live/accounts/route.ts` | New endpoint returning account list with status |
| `/app/components/live/AccountSelector.tsx` | Dropdown component for account switching |

## Files to Modify

| File | Change |
|------|--------|
| `/app/api/live/account/route.ts` | Accept `accountId` param, use shared resolver |
| `/app/api/live/positions/route.ts` | Accept `accountId` param, use shared resolver |
| `/app/api/live/history/route.ts` | Accept `accountId` param, use shared resolver |
| `/app/api/live/health/route.ts` | Accept `accountId` param, use shared resolver |
| `/app/hooks/useLiveData.ts` | Accept `accountId` param, include in fetch URLs, reset on change |
| `/app/live/page.tsx` | Add AccountSelector, read `accountId` from URL search params |
| `docker-compose.yml` or equivalent | Add `accounts.json` volume mount |
| `.gitignore` | Add `accounts.json` (contains local endpoint config) |

## Testing

- Verify dropdown populates from `accounts.json`
- Verify switching accounts updates URL, resets data, and fetches from correct endpoint
- Verify localStorage remembers last selection across page reloads
- Verify fallback to `MT5_API_ENDPOINT` when `accounts.json` is missing
- Verify 404 response when `accountId` doesn't match any configured account
- Verify offline accounts show correctly in dropdown and dashboard

## Out of Scope

- Settings UI for adding/removing accounts in the browser
- Aggregate/multi-account dashboard view
- Account-specific theming or layout differences
- Authentication or access control per account
