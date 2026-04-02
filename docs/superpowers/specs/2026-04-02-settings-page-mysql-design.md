# Settings Page & MySQL Account Storage — Design Spec

## Overview

Replace the file-based `accounts.json` approach with a MySQL-backed settings page at `/live/settings`. Users can add, edit, and delete MT5 account configurations through a UI instead of editing a JSON file.

## Motivation

Editing `accounts.json` requires knowing the correct endpoint format (`host.docker.internal` vs `localhost`), JSON syntax, and container volume mounts. A settings page makes account management accessible without technical knowledge.

## Database

**Database:** `db_metatrader_journal` (new, on existing `lgu-mysql` container)

**Table:** `mt5_accounts`

```sql
CREATE TABLE mt5_accounts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  type        ENUM('live', 'propfirm') NOT NULL DEFAULT 'live',
  endpoint    VARCHAR(255) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Fields:**
- `slug` — URL-safe identifier used in query param (`/live?account=slug`), auto-generated from name but editable
- `name` — display name in the dropdown (e.g., "Live Trading", "FTMO Challenge")
- `type` — `live` or `propfirm`, for visual distinction
- `endpoint` — Flask bridge URL (e.g., `http://host.docker.internal:5555`)
- `sort_order` — controls dropdown ordering; first account (lowest sort_order) is the default

**Initialization:** On app startup, the database and table are created if they don't exist. No default account is seeded — the user adds accounts via the settings page.

## Database Connection

**File:** `app/lib/db.ts`

- Uses `mysql2/promise` package for async MySQL queries
- Creates a connection pool (shared across all API routes)
- Runs the database/table initialization on first connection
- Connection config via environment variables:
  - `MYSQL_HOST` (default: `lgu-mysql`)
  - `MYSQL_USER` (default: `root`)
  - `MYSQL_PASSWORD`
  - `MYSQL_DATABASE` (default: `db_metatrader_journal`)

## API Changes

### Modified: `app/lib/accounts.ts`

Replace file-based `loadAccounts()` and `resolveEndpoint()` with MySQL queries:

- `loadAccounts()` — `SELECT * FROM mt5_accounts ORDER BY sort_order ASC, id ASC`
- `resolveEndpoint(slug)` — `SELECT endpoint FROM mt5_accounts WHERE slug = ?`
- Remove `accounts.json` file reading logic
- Remove `MT5_API_ENDPOINT` env var fallback
- If no accounts exist, `loadAccounts()` returns an empty array

### Existing Routes (unchanged interface)

These routes continue to work as-is. They already call `resolveEndpoint()` — only the implementation changes:

- `GET /api/live/account?accountId=<slug>`
- `GET /api/live/positions?accountId=<slug>`
- `GET /api/live/history?accountId=<slug>&days=N`
- `GET /api/live/health?accountId=<slug>`
- `GET /api/live/accounts` — returns account list with health status

### New CRUD Routes

**`POST /api/live/accounts`** — Create account

Request body:
```json
{
  "slug": "propfirm-1",
  "name": "FTMO Challenge",
  "type": "propfirm",
  "endpoint": "http://host.docker.internal:5556"
}
```
Response: `201` with created account object, or `400` if slug already exists.

**`PUT /api/live/accounts/[id]`** — Update account

Request body: same shape as POST (partial updates allowed).
Response: `200` with updated account object, or `404` if not found.

**`DELETE /api/live/accounts/[id]`** — Delete account

Response: `200` with `{ success: true }`, or `404` if not found.

## Frontend Changes

### Settings Page: `/live/settings`

**Route:** `app/live/settings/page.tsx`

**Layout:**
- Shares the existing live layout (Header with back arrow to `/live`)
- Page title: "Account Settings"
- Table/list of configured accounts
- "Add Account" button above the list

**Account list columns:**
- Name (with type badge: live/propfirm)
- Endpoint URL
- Status (online/offline dot, fetched from `/api/live/accounts`)
- Actions (Edit, Delete buttons)

**Add/Edit form (inline, not modal):**
- Name (text input)
- Slug (auto-generated from name via kebab-case, editable)
- Type (dropdown: live / propfirm)
- Endpoint (text input, placeholder: `http://host.docker.internal:5555`)
- Save / Cancel buttons

**Delete:** Inline confirmation — clicking Delete shows "Are you sure?" with Confirm/Cancel replacing the action buttons.

**Empty state:** When no accounts are configured, show a message: "No accounts configured. Add an account to get started." with a prominent Add Account button.

### Navigation to Settings

Add a gear icon button in the `/live` page header (next to the account selector dropdown) that links to `/live/settings`.

### Account Selector Changes

- `AccountSelector` dropdown: if no accounts exist, show "No accounts — Configure" link to `/live/settings`
- The dropdown continues to fetch from `GET /api/live/accounts` (unchanged)

## Files to Create

| File | Purpose |
|------|---------|
| `app/lib/db.ts` | MySQL connection pool and initialization |
| `app/api/live/accounts/[id]/route.ts` | PUT and DELETE for individual accounts |
| `app/live/settings/page.tsx` | Settings page UI |
| `app/components/live/AccountForm.tsx` | Reusable add/edit form component |
| `app/components/live/AccountList.tsx` | Account list/table component |

## Files to Modify

| File | Change |
|------|--------|
| `app/lib/accounts.ts` | Replace file I/O with MySQL queries |
| `app/api/live/accounts/route.ts` | Add POST handler alongside existing GET |
| `app/live/page.tsx` | Add gear icon link to settings |
| `app/components/live/AccountSelector.tsx` | Handle empty accounts state |
| `Dockerfile` | Remove `COPY accounts.example.json`, add `mysql2` in dependencies |
| `package.json` | Add `mysql2` dependency |

## Files to Remove

| File | Reason |
|------|--------|
| `accounts.example.json` | No longer needed — accounts stored in database |
| `accounts.json` | Replaced by database (was gitignored anyway) |

## Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `MYSQL_HOST` | `lgu-mysql` | MySQL container hostname on Docker network |
| `MYSQL_USER` | `root` | Database user |
| `MYSQL_PASSWORD` | (from Docker config) | Database password |
| `MYSQL_DATABASE` | `db_metatrader_journal` | Database name |

These are passed to the `trading` container at runtime.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| MySQL connection fails | API routes return 503. Settings page shows connection error. Live dashboard shows "Offline" for all accounts. |
| No accounts configured | Live page shows AccountSelector with "No accounts — Configure" link. Settings page shows empty state with Add button. |
| Duplicate slug on create | POST returns 400 with `{ error: "Account with this slug already exists" }` |
| Delete last account | Allowed — same as no accounts configured state |
| Invalid endpoint URL | Accepted on save — will show as "Offline" in the dropdown when health check fails |

## Out of Scope

- Authentication/authorization for the settings page
- Importing accounts from `accounts.json`
- Account reordering UI (sort_order is set manually or defaults to insert order)
- Backup/export of account configurations
