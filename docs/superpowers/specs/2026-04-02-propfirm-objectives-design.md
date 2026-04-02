# Prop Firm Objectives — Design Spec

## Overview

Add prop firm rule templates and an Objectives tab to the live trading dashboard. Rule templates define the objectives for a prop firm challenge (max daily loss, max total loss, profit target, min trading days, etc.). The Objectives tab shows real-time progress against these rules, appearing only for prop firm accounts with an assigned rule set.

## Motivation

Prop firm traders need to monitor their challenge objectives in real time — daily loss limits, drawdown limits, profit targets, and minimum trading days. Currently the app treats prop firm and live accounts identically. This feature adds prop-firm-specific analytics without affecting live accounts.

## Database

### New Table: `propfirm_rules`

```sql
CREATE TABLE propfirm_rules (
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
);
```

### Modified Table: `mt5_accounts`

Add column:
```sql
ALTER TABLE mt5_accounts ADD COLUMN rule_id INT DEFAULT NULL;
```

`rule_id` references `propfirm_rules.id`. Only prop firm accounts have this set. Live accounts leave it `NULL`.

## Rules Management Page

**Route:** `/live/rules`

**Layout:**
- List of saved rule templates showing: name, account size, max daily loss, max total loss, profit target, min/max trading days
- "Add Rule Set" button
- Each row has Edit and Delete actions (inline delete confirmation)
- Add/Edit form (inline, same style as account settings form)

**Form fields:**
- Name (text, e.g., "FTMO Challenge 10k")
- Account Size (number, e.g., 10000)
- Max Daily Loss (number + type dropdown: money/percent)
- Daily Loss Calculation (dropdown: balance-based/equity-based)
- Max Total Loss (number + type dropdown: money/percent)
- Profit Target (number + type dropdown: money/percent)
- Min Trading Days (number, 0 = no minimum)
- Max Trading Days (number, empty = unlimited)

**Navigation:** Link from the account settings page (`/live/settings`) to `/live/rules`.

## Account Settings Integration

When editing a **prop firm** account on `/live/settings`, a new **"Rule Set"** dropdown appears below the existing fields. It lists all templates from `propfirm_rules` plus a "None" option. Live accounts don't show this field.

## API Routes

### New Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/live/rules` | GET | List all rule templates |
| `POST /api/live/rules` | POST | Create a rule template |
| `PUT /api/live/rules/[id]` | PUT | Update a rule template |
| `DELETE /api/live/rules/[id]` | DELETE | Delete a rule template |
| `GET /api/live/rules/[id]` | GET | Get a single rule template |

### Modified Routes

| Route | Change |
|-------|--------|
| `GET /api/live/accounts` | Include `rule_id` in response for each account |
| `POST /api/live/accounts` | Accept optional `rule_id` field |
| `PUT /api/live/accounts/[id]` | Accept optional `rule_id` field |
| `GET /api/live/accounts/[id]/detail` | Include full rule template data if `rule_id` is set |

## Objectives Tab

**Position:** After the Overview tab — tab order: Overview, Objectives, Trades, Calendar, Performance.

**Visibility:** Only appears for prop firm accounts that have a `rule_id` assigned. Live accounts and prop firms without rules don't see this tab.

### Objectives Checklist

Table showing each rule with columns:

| Column | Content |
|--------|---------|
| Objective | Rule name (e.g., "Max Daily Loss") |
| Result | Current calculated value |
| Target | Rule threshold from template |
| Status | Pass (green check) / Fail (red X) / In Progress (yellow clock) |

### Objective Calculations

All calculations are client-side from trade history and account data.

| Objective | Calculation | Status Logic |
|-----------|-------------|-------------|
| Min Trading Days | Count distinct dates with closed trades | Green if met, yellow if not yet met |
| Max Daily Loss | Balance-based: day's starting balance - current equity. Equity-based: day's peak equity - current equity | Green if within limit, red if breached |
| Max Total Loss | Account size - current equity | Green if within limit, red if breached |
| Profit Target | Current balance - account size | Green if reached, yellow if in progress |
| Max Trading Days | Days elapsed since first trade vs limit | Green if within limit, red if exceeded. Hidden if unlimited. |

### Discipline Score

Percentage gauge (0-100%) showing overall safety margin across all objectives. Calculated as the average distance from each violation threshold, normalized to 0-100.

For example:
- Max Daily Loss is 5%, current daily loss is 2% → 60% safe (2/5 used, 3/5 remaining = 60%)
- Max Total Loss is 10%, current total loss is 3% → 70% safe
- Profit Target is 10%, current profit is 8% → 80% achieved
- Average = discipline score

## Files to Create

| File | Purpose |
|------|---------|
| `app/lib/rules.ts` | CRUD functions for propfirm_rules table |
| `app/api/live/rules/route.ts` | GET (list) + POST (create) |
| `app/api/live/rules/[id]/route.ts` | GET + PUT + DELETE for individual rules |
| `app/live/rules/page.tsx` | Rules management page |
| `app/components/live/RuleForm.tsx` | Add/edit form for rule templates |
| `app/components/live/RuleList.tsx` | List of rule templates |
| `app/components/live/ObjectivesTab.tsx` | Objectives tab component |
| `app/lib/objectives.ts` | Pure functions: calculate objective status, discipline score, daily loss |

## Files to Modify

| File | Change |
|------|--------|
| `app/lib/db.ts` | Add `propfirm_rules` table creation and `rule_id` column to `mt5_accounts` |
| `app/lib/accounts.ts` | Add `rule_id` to account CRUD operations |
| `app/lib/live-types.ts` | Add `PropfirmRule`, `ObjectiveStatus` types, add `rule_id` to `AccountConfig` |
| `app/api/live/accounts/route.ts` | Include `rule_id` in responses |
| `app/api/live/accounts/[id]/route.ts` | Accept `rule_id` in PUT |
| `app/api/live/accounts/[id]/detail/route.ts` | Include rule template data |
| `app/live/page.tsx` | Add Objectives tab (conditional on rule_id), fetch rule data |
| `app/live/settings/page.tsx` | Add rule set dropdown for prop firm accounts, link to rules page |
| `app/components/live/AccountForm.tsx` | Add rule_id dropdown for propfirm type |
| `app/components/live/LiveTabs.tsx` | Support conditional Objectives tab |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Prop firm account with no rule set | Objectives tab hidden |
| Live account | Objectives tab never shown |
| Rule template deleted while assigned | Account's rule_id set to NULL via ON DELETE SET NULL, objectives tab disappears |
| No trade history | Objectives show 0/target with "in progress" status |
| No trades today | Daily loss = 0, shows as passing |
| Max trading days is NULL | Max Trading Days objective row hidden |
| Min trading days is 0 | Min Trading Days objective row hidden |

## Out of Scope

- Automatic prop firm rule detection from broker
- Historical objective tracking (snapshots over time)
- Notifications/alerts when approaching limits
- Multiple phases per account (challenge → verification → funded)
