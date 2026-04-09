#!/bin/bash
# sync-tunnel.sh — Auto-sync SSH tunnel ports with MT5 account endpoints
#
# Reads all account endpoints from the MySQL database, extracts the ports,
# and ensures each port has a corresponding -L forward in the autossh plist.
# If any ports are missing, updates the plist and reloads the tunnel.
#
# Designed to run on the Mac host (not inside Docker) via launchd or cron.

set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/com.jsonfx.mt5tunnel.plist"
MYSQL_CONTAINER="lgu-mysql"
MYSQL_DB="db_metatrader_journal"
MYSQL_USER="root"
MYSQL_PASS="DpCH7pisSoTNjOxApMbiDrpQc0obOLU"

# ── 1. Get all ports from account endpoints in the database ───────────────────
DB_PORTS=$(docker exec "$MYSQL_CONTAINER" mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" -N -B "$MYSQL_DB" \
  -e "SELECT endpoint FROM mt5_accounts" 2>/dev/null \
  | grep -oE ':[0-9]+$' \
  | tr -d ':' \
  | sort -un)

if [ -z "$DB_PORTS" ]; then
  exit 0  # no accounts yet
fi

# ── 2. Get ports already in the plist ─────────────────────────────────────────
PLIST_PORTS=$(grep -oE '[0-9]+:127\.0\.0\.1:[0-9]+' "$PLIST" \
  | grep -oE '^[0-9]+' \
  | sort -un)

# ── 3. Find missing ports ────────────────────────────────────────────────────
MISSING=""
for port in $DB_PORTS; do
  if ! echo "$PLIST_PORTS" | grep -qx "$port"; then
    MISSING="$MISSING $port"
  fi
done

if [ -z "$MISSING" ]; then
  exit 0  # all ports already tunneled
fi

# ── 4. Add missing ports to plist ─────────────────────────────────────────────
for port in $MISSING; do
  # Insert -L lines before the Administrator@ line
  sed -i '' "s|<string>Administrator@|<string>-L</string>\n    <string>${port}:127.0.0.1:${port}</string>\n    <string>Administrator@|" "$PLIST"
  echo "$(date '+%Y-%m-%d %H:%M:%S') Added tunnel for port $port"
done

# ── 5. Reload the tunnel ─────────────────────────────────────────────────────
launchctl unload "$PLIST"
launchctl load "$PLIST"
echo "$(date '+%Y-%m-%d %H:%M:%S') Tunnel reloaded with new ports:$MISSING"
