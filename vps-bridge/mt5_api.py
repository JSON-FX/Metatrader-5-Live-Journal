"""
mt5_api.py — Flask REST bridge for MetaTrader 5
================================================
Exposes REST endpoints consumed by metatrader-mcp (server.js) and the
Next.js Trading Journal (/api/live/* proxy routes).

USAGE
-----
Run one instance per MT5 account, each on a different port:

    # Live account
    set MT5_LOGIN=12345678
    set MT5_PATH=C:\\Program Files\\MetaTrader 5 (IC Markets)\\terminal64.exe
    set MT5_SERVER=ICMarketsSC-MT5-2
    set FLASK_PORT=5555
    python mt5_api.py

    # Prop firm account
    set MT5_LOGIN=87654321
    set MT5_PATH=C:\\Program Files\\MetaTrader 5 (PropFirm)\\terminal64.exe
    set MT5_SERVER=YourPropFirmServer
    set FLASK_PORT=5556
    python mt5_api.py

IMPORTANT
---------
- Must run on the same Windows machine AND same user session as MT5.
- MT5 terminal must already be running and logged in before starting this script.
- The MetaTrader5 Python library connects via shared memory, not network.
- Binds to 127.0.0.1 only — access via SSH tunnel from Mac.

ENDPOINTS
---------
GET /health              — Connection status + MT5 version
GET /account             — Balance, equity, floating P/L, drawdown
GET /positions           — All open positions
GET /orders              — All pending orders
GET /history?days=90     — Closed trades (paired round-trips)
GET /raw-deals?days=90   — All historical deals (unpaired)
GET /raw-orders?days=90  — All historical orders (filled, canceled, etc.)
GET /symbol/<symbol>     — Current bid/ask for a symbol
GET /rates               — OHLC bars for charting (symbol, timeframe, from, to)
"""

import os
import logging
from datetime import datetime, timezone, timedelta

from flask import Flask, jsonify, request
from flask_cors import CORS
import MetaTrader5 as mt5

# ─────────────────────────────────────────────────────────────────────────────
# Configuration from environment
# ─────────────────────────────────────────────────────────────────────────────

MT5_PATH     = os.environ.get("MT5_PATH", "")
MT5_LOGIN    = int(os.environ.get("MT5_LOGIN", "0"))
MT5_PASSWORD = os.environ.get("MT5_PASSWORD", "")
MT5_SERVER   = os.environ.get("MT5_SERVER", "")
FLASK_PORT   = int(os.environ.get("FLASK_PORT", "5555"))

# Auto-detected broker GMT offset (updated on each /health check).
# Falls back to BROKER_GMT_OFFSET env var if auto-detection fails.
_BROKER_GMT_OFFSET_FALLBACK = int(os.environ.get("BROKER_GMT_OFFSET", "0"))
_broker_gmt_offset: int = _BROKER_GMT_OFFSET_FALLBACK

# ─────────────────────────────────────────────────────────────────────────────
# Flask app setup
# ─────────────────────────────────────────────────────────────────────────────

app = Flask(__name__)
# Allow requests from the Next.js journal dev server and production origin.
# Add your production domain here if you deploy the journal to a server.
CORS(app, origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
])

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Broker GMT offset auto-detection  (same approach as the EA's DetectGMTOffset)
# ─────────────────────────────────────────────────────────────────────────────

def detect_gmt_offset() -> None:
    """
    Compare a live tick timestamp (broker-local) with real UTC to derive the
    broker's GMT offset.  Called from /health so it stays current across DST
    transitions.  Mirrors the EA's DetectGMTOffset() logic.
    """
    global _broker_gmt_offset

    try:
        # Use a liquid symbol to get a fresh tick
        for sym in ("EURUSD", "GBPUSD", "USDJPY"):
            tick = mt5.symbol_info_tick(sym)
            if tick is not None:
                break
        else:
            return  # no tick available — keep previous offset

        broker_ts  = tick.time                                  # broker-local unix ts
        real_utc   = int(datetime.now(timezone.utc).timestamp())
        diff_secs  = broker_ts - real_utc
        diff_hours = round(diff_secs / 3600)

        # Sanity check (same as EA: -12..+14)
        if diff_hours < -12 or diff_hours > 14:
            return

        if diff_hours != _broker_gmt_offset:
            logger.info("GMT offset changed: %+d → %+d (DST transition?)",
                        _broker_gmt_offset, diff_hours)

        _broker_gmt_offset = diff_hours
    except Exception:
        pass  # keep previous offset on any error


def broker_ts_to_utc(ts: int) -> str:
    """Convert an MT5 broker-local Unix timestamp to a true-UTC ISO 8601 string."""
    dt = datetime.fromtimestamp(ts, tz=timezone.utc) - timedelta(hours=_broker_gmt_offset)
    return dt.isoformat()


# Timeframes supported by /rates. Keep keys short and uppercase for the query param.
TIMEFRAME_MAP = {
    "M1":  mt5.TIMEFRAME_M1,
    "M5":  mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "H1":  mt5.TIMEFRAME_H1,
    "H4":  mt5.TIMEFRAME_H4,
    "D1":  mt5.TIMEFRAME_D1,
}
MAX_BARS = 2000


# ─────────────────────────────────────────────────────────────────────────────
# MT5 connection helpers
# ─────────────────────────────────────────────────────────────────────────────

def ensure_connected() -> bool:
    """
    Connect (or reconnect) to the configured MT5 terminal.
    Uses MT5_LOGIN + MT5_PATH to pin this bridge to a specific terminal,
    which is essential when multiple MT5 instances are running simultaneously.
    """
    # If already connected to the right account, nothing to do
    info = mt5.terminal_info()
    if info is not None:
        account = mt5.account_info()
        if account and (MT5_LOGIN == 0 or account.login == MT5_LOGIN):
            return True
        # Connected to wrong account — reconnect
        mt5.shutdown()

    # Build initialize() kwargs
    kwargs: dict = {"timeout": 10000}
    if MT5_PATH:
        kwargs["path"] = MT5_PATH
    if MT5_LOGIN:
        kwargs["login"] = MT5_LOGIN
    if MT5_PASSWORD:
        kwargs["password"] = MT5_PASSWORD
    if MT5_SERVER:
        kwargs["server"] = MT5_SERVER

    if not mt5.initialize(**kwargs):
        logger.error("mt5.initialize() failed: %s", mt5.last_error())
        return False

    account = mt5.account_info()
    if account:
        logger.info("Connected to MT5 account %s on %s", account.login, account.server)
    return True


def error_response(message: str, code: int = 500):
    """Return a JSON error with the last MT5 error code."""
    return jsonify({
        "error": message,
        "mt5_error": str(mt5.last_error())
    }), code


# ─────────────────────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """
    Returns MT5 connection status and version.
    The journal polls this to display the Live / Offline badge.
    """
    connected = ensure_connected()
    version   = mt5.version() if connected else None
    account   = mt5.account_info() if connected else None

    # Auto-detect broker GMT offset (mirrors EA's DetectGMTOffset)
    if connected:
        detect_gmt_offset()

    return jsonify({
        "status":       "ok" if connected else "mt5_disconnected",
        "mt5_version":  ".".join(str(v) for v in version) if version else None,
        "account":      account.login if account else None,
        "server":       account.server if account else None,
        "gmt_offset":   _broker_gmt_offset,
        "timestamp":    datetime.now(timezone.utc).isoformat(),
    }), 200 if connected else 503


# ─────────────────────────────────────────────────────────────────────────────
# Account info
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/account", methods=["GET"])
def get_account():
    """
    Returns balance, equity, margin, floating P/L and drawdown metrics.
    Consumed by: MCP get_account_info tool, LiveAccountPanel component.
    """
    if not ensure_connected():
        return error_response("MT5 not connected")

    info = mt5.account_info()
    if info is None:
        return error_response("Failed to retrieve account info")

    d           = info._asdict()
    balance     = d.get("balance", 0)
    equity      = d.get("equity", 0)
    floating    = equity - balance
    dd_pct      = ((balance - equity) / balance * 100) if balance > 0 and equity < balance else 0.0

    return jsonify({
        "login":        d.get("login"),
        "name":         d.get("name"),
        "server":       d.get("server"),
        "currency":     d.get("currency"),
        "balance":      round(balance, 2),
        "equity":       round(equity, 2),
        "margin":       round(d.get("margin", 0), 2),
        "free_margin":  round(d.get("margin_free", 0), 2),
        "margin_level": round(d.get("margin_level", 0), 2),
        "floating_pnl": round(floating, 2),
        "drawdown_pct": round(dd_pct, 2),
        "leverage":     d.get("leverage"),
        "profit":       round(d.get("profit", 0), 2),
        "timestamp":    datetime.now(timezone.utc).isoformat(),
    })


# ─────────────────────────────────────────────────────────────────────────────
# Open positions
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/positions", methods=["GET"])
def get_positions():
    """
    Returns all currently open positions.
    Consumed by: MCP get_open_positions tool, OpenPositionsPanel component.
    """
    if not ensure_connected():
        return error_response("MT5 not connected")

    positions = mt5.positions_get()

    # None = error; empty tuple = no positions (both valid)
    if positions is None:
        if mt5.last_error()[0] != 0:
            return error_response("Failed to retrieve positions")
        return jsonify([])

    result = []
    for pos in positions:
        d        = pos._asdict()
        pos_type = "buy" if d.get("type") == 0 else "sell"
        result.append({
            "ticket":        d.get("ticket"),
            "symbol":        d.get("symbol"),
            "type":          pos_type,
            "volume":        d.get("volume"),
            "open_price":    round(d.get("price_open", 0), 5),
            "current_price": round(d.get("price_current", 0), 5),
            "sl":            d.get("sl") or None,
            "tp":            d.get("tp") or None,
            "profit":        round(d.get("profit", 0), 2),
            "swap":          round(d.get("swap", 0), 2),
            "commission":    round(d.get("commission", 0), 2),
            "open_time":     broker_ts_to_utc(d.get("time", 0)),
            "comment":       d.get("comment", ""),
            "magic":         d.get("magic", 0),
        })

    return jsonify(result)


# ─────────────────────────────────────────────────────────────────────────────
# Pending orders
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/orders", methods=["GET"])
def get_orders():
    """
    Returns all pending orders.
    Consumed by: MCP get_pending_orders tool.
    """
    if not ensure_connected():
        return error_response("MT5 not connected")

    orders = mt5.orders_get()

    if orders is None:
        if mt5.last_error()[0] != 0:
            return error_response("Failed to retrieve orders")
        return jsonify([])

    type_map = {
        0: "buy",            1: "sell",
        2: "buy_limit",      3: "sell_limit",
        4: "buy_stop",       5: "sell_stop",
        6: "buy_stop_limit", 7: "sell_stop_limit",
    }

    result = []
    for order in orders:
        d = order._asdict()
        result.append({
            "ticket":    d.get("ticket"),
            "symbol":    d.get("symbol"),
            "type":      type_map.get(d.get("type", 0), "unknown"),
            "volume":    d.get("volume_initial"),
            "price":     d.get("price_open"),
            "sl":        d.get("sl") or None,
            "tp":        d.get("tp") or None,
            "open_time": broker_ts_to_utc(d.get("time_setup", 0)),
            "comment":   d.get("comment", ""),
            "magic":     d.get("magic", 0),
        })

    return jsonify(result)


# ─────────────────────────────────────────────────────────────────────────────
# Trade history
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/history", methods=["GET"])
def get_history():
    """
    Returns closed trades (round-trips) for the account.

    Query params:
      days  — how many calendar days back to fetch (default 90, max 3650)

    MT5 returns individual deals (entries + exits). This endpoint pairs them
    by position_id to produce one record per completed trade.
    Consumed by: LiveTradesTable component.
    """
    if not ensure_connected():
        return error_response("MT5 not connected")

    try:
        days = min(int(request.args.get("days", 90)), 3650)
    except (ValueError, TypeError):
        days = 90

    from_date = datetime.now(timezone.utc) - timedelta(days=days)
    to_date   = datetime.now(timezone.utc) + timedelta(days=1)

    deals = mt5.history_deals_get(from_date, to_date)

    if deals is None:
        if mt5.last_error()[0] != 0:
            return error_response("Failed to retrieve history")
        return jsonify([])

    # ── Fetch historical orders to get SL/TP ──────────────────────────────
    orders = mt5.history_orders_get(from_date, to_date)
    order_sl_tp: dict = {}  # position_id -> { sl, tp }
    if orders:
        for order in orders:
            o = order._asdict()
            pos_id = o.get("position_id", 0)
            sl = o.get("sl", 0)
            tp = o.get("tp", 0)
            # Keep the first order's SL/TP (the entry order)
            if pos_id and pos_id not in order_sl_tp and (sl or tp):
                order_sl_tp[pos_id] = {"sl": sl, "tp": tp}

    # ── Pair in/out deals by position_id ────────────────────────────────────
    # deal.entry: 0=in, 1=out, 2=in/out (reverse)
    # deal.type:  0=buy, 1=sell (direction of the entry deal)
    ENTRY_IN  = 0
    ENTRY_OUT = 1

    entries: dict = {}   # position_id -> entry deal dict
    trades  = []

    for deal in deals:
        d = deal._asdict()
        entry = d.get("entry", -1)
        pos_id = d.get("position_id", 0)
        deal_type = d.get("type", -1)

        # Skip balance/credit/deposit/dividend deals (type >= 2)
        if deal_type >= 2:
            continue

        if entry == ENTRY_IN:
            entries[pos_id] = d
        elif entry == ENTRY_OUT:
            open_d = entries.pop(pos_id, None)
            trade_type = "buy" if (open_d or d).get("type", 1) == 0 else "sell"
            sl_tp = order_sl_tp.get(pos_id, {})
            trades.append({
                "ticket":      pos_id,
                "symbol":      d.get("symbol", ""),
                "type":        trade_type,
                "volume":      round(d.get("volume", 0), 2),
                "open_price":  round(open_d.get("price", 0) if open_d else 0, 5),
                "close_price": round(d.get("price", 0), 5),
                "sl":          sl_tp.get("sl") or None,
                "tp":          sl_tp.get("tp") or None,
                "open_time":   broker_ts_to_utc(
                                   open_d.get("time", 0) if open_d else d.get("time", 0)
                               ),
                "close_time":  broker_ts_to_utc(d.get("time", 0)),
                "profit":      round(d.get("profit", 0), 2),
                "commission":  round(
                                   (open_d.get("commission", 0) if open_d else 0)
                                   + d.get("commission", 0),
                                   2
                               ),
                "swap":        round(d.get("swap", 0), 2),
                "comment":     d.get("comment", ""),
                "magic":       d.get("magic", 0),
            })

    # Most recent first
    trades.sort(key=lambda t: t["close_time"], reverse=True)
    return jsonify(trades)


# ─────────────────────────────────────────────────────────────────────────────
# Raw deals (unpaired)
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/raw-deals", methods=["GET"])
def get_raw_deals():
    """
    Returns all historical deals without pairing.
    Includes trading deals (buy/sell), balance operations, credits, etc.
    """
    if not ensure_connected():
        return error_response("MT5 not connected")

    try:
        days = min(int(request.args.get("days", 90)), 3650)
    except (ValueError, TypeError):
        days = 90

    from_date = datetime.now(timezone.utc) - timedelta(days=days)
    to_date   = datetime.now(timezone.utc) + timedelta(days=1)

    deals = mt5.history_deals_get(from_date, to_date)

    if deals is None:
        if mt5.last_error()[0] != 0:
            return error_response("Failed to retrieve deals")
        return jsonify([])

    type_map = {
        0: "buy", 1: "sell", 2: "balance", 3: "credit",
        4: "charge", 5: "correction",
    }
    entry_map = {0: "in", 1: "out", 2: "reverse"}

    result = []
    for deal in deals:
        d = deal._asdict()
        result.append({
            "ticket":      d.get("ticket"),
            "position_id": d.get("position_id", 0),
            "symbol":      d.get("symbol", ""),
            "type":        type_map.get(d.get("type", -1), "other"),
            "entry":       entry_map.get(d.get("entry", -1), ""),
            "volume":      round(d.get("volume", 0), 2),
            "price":       round(d.get("price", 0), 5),
            "profit":      round(d.get("profit", 0), 2),
            "commission":  round(d.get("commission", 0), 2),
            "swap":        round(d.get("swap", 0), 2),
            "time":        broker_ts_to_utc(d.get("time", 0)),
            "comment":     d.get("comment", ""),
            "magic":       d.get("magic", 0),
        })

    # Most recent first
    result.sort(key=lambda d: d["time"], reverse=True)
    return jsonify(result)


# ─────────────────────────────────────────────────────────────────────────────
# Raw historical orders
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/raw-orders", methods=["GET"])
def get_raw_orders():
    """
    Returns all historical orders (filled, canceled, expired, etc.).
    """
    if not ensure_connected():
        return error_response("MT5 not connected")

    try:
        days = min(int(request.args.get("days", 90)), 3650)
    except (ValueError, TypeError):
        days = 90

    from_date = datetime.now(timezone.utc) - timedelta(days=days)
    to_date   = datetime.now(timezone.utc) + timedelta(days=1)

    orders = mt5.history_orders_get(from_date, to_date)

    if orders is None:
        if mt5.last_error()[0] != 0:
            return error_response("Failed to retrieve historical orders")
        return jsonify([])

    type_map = {
        0: "buy",            1: "sell",
        2: "buy_limit",      3: "sell_limit",
        4: "buy_stop",       5: "sell_stop",
        6: "buy_stop_limit", 7: "sell_stop_limit",
    }
    state_map = {
        0: "started", 1: "placed", 2: "canceled",
        3: "partial", 4: "filled", 5: "rejected", 6: "expired",
    }

    result = []
    for order in orders:
        d = order._asdict()
        result.append({
            "ticket":         d.get("ticket"),
            "position_id":    d.get("position_id", 0),
            "symbol":         d.get("symbol", ""),
            "type":           type_map.get(d.get("type", -1), "unknown"),
            "volume_initial": round(d.get("volume_initial", 0), 2),
            "volume_current": round(d.get("volume_current", 0), 2),
            "price":          round(d.get("price_open", 0), 5),
            "sl":             d.get("sl") or None,
            "tp":             d.get("tp") or None,
            "state":          state_map.get(d.get("state", -1), "unknown"),
            "time_setup":     broker_ts_to_utc(d.get("time_setup", 0)),
            "time_done":      broker_ts_to_utc(d.get("time_done", 0)),
            "comment":        d.get("comment", ""),
            "magic":          d.get("magic", 0),
        })

    # Most recent first
    result.sort(key=lambda d: d["time_setup"], reverse=True)
    return jsonify(result)


# ─────────────────────────────────────────────────────────────────────────────
# Symbol price
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/symbol/<symbol>", methods=["GET"])
def get_symbol_price(symbol: str):
    """
    Returns current bid/ask for a symbol.
    Consumed by: MCP get_symbol_price tool.
    """
    if not ensure_connected():
        return error_response("MT5 not connected")

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return error_response(f"Symbol '{symbol}' not found or not subscribed", 404)

    return jsonify({
        "symbol":    symbol,
        "bid":       tick.bid,
        "ask":       tick.ask,
        "spread":    round((tick.ask - tick.bid) * 10000, 1),  # approximate pips
        "timestamp": broker_ts_to_utc(tick.time),
    })


# ─────────────────────────────────────────────────────────────────────────────
# Rates (OHLC bars for charting)
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/rates", methods=["GET"])
def get_rates():
    """
    Returns OHLC bars for a symbol, timeframe, and UTC time range.

    Query params:
      symbol     — MT5 symbol (e.g. EURUSD, XAUUSD) — required
      timeframe  — one of M1, M5, M15, H1, H4, D1 — required
      from       — UTC unix seconds, inclusive — required
      to         — UTC unix seconds, inclusive (> from) — required

    Response:
      { "symbol": str, "timeframe": str,
        "bars": [ { "time": int (UTC unix secs),
                    "open": float, "high": float, "low": float, "close": float }, ... ] }

    Timezone handling (verified empirically against real fills, not MT5 docs):
      • Input datetimes are treated by mt5.copy_rates_range as UTC-aware.
      • Returned bar 'time' values come back in broker-local wall-clock as unix
        seconds — NOT UTC, despite what MQL5 docs imply. So we subtract the
        detected broker GMT offset to yield true UTC.
    """
    if not ensure_connected():
        return error_response("MT5 not connected")

    symbol   = request.args.get("symbol", "").strip()
    tf_key   = request.args.get("timeframe", "").upper()
    from_str = request.args.get("from")
    to_str   = request.args.get("to")

    if not symbol:
        return jsonify({"error": "Missing 'symbol'"}), 400
    if tf_key not in TIMEFRAME_MAP:
        return jsonify({
            "error": f"Invalid timeframe '{tf_key}'. "
                     f"Expected one of {list(TIMEFRAME_MAP)}"
        }), 400
    try:
        from_ts = int(from_str)
        to_ts   = int(to_str)
    except (TypeError, ValueError):
        return jsonify({"error": "'from' and 'to' must be unix seconds (int)"}), 400
    if from_ts >= to_ts:
        return jsonify({"error": "'from' must be before 'to'"}), 400

    if mt5.symbol_info(symbol) is None:
        return jsonify({"error": f"Symbol '{symbol}' not found on this account"}), 404

    # Inputs go in as UTC-aware; MT5 treats them as UTC.
    from_dt = datetime.fromtimestamp(from_ts, tz=timezone.utc)
    to_dt   = datetime.fromtimestamp(to_ts,   tz=timezone.utc)

    rates = mt5.copy_rates_range(symbol, TIMEFRAME_MAP[tf_key], from_dt, to_dt)
    if rates is None:
        return error_response("Failed to retrieve rates")

    # Safety cap — keep the most recent MAX_BARS if the range is oversized.
    if len(rates) > MAX_BARS:
        rates = rates[-MAX_BARS:]

    # Output: subtract broker offset to convert broker-local → true UTC.
    offset_secs = _broker_gmt_offset * 3600
    bars = [
        {
            "time":  int(r["time"]) - offset_secs,
            "open":  float(r["open"]),
            "high":  float(r["high"]),
            "low":   float(r["low"]),
            "close": float(r["close"]),
        }
        for r in rates
    ]

    return jsonify({
        "symbol":    symbol,
        "timeframe": tf_key,
        "bars":      bars,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    account_label = f"account {MT5_LOGIN}" if MT5_LOGIN else "default account"
    print(f"Starting MT5 Flask bridge for {account_label} on http://127.0.0.1:{FLASK_PORT}")
    print(f"Broker GMT offset: auto-detect (fallback: {_BROKER_GMT_OFFSET_FALLBACK:+d})")
    print("MT5 terminal must be running and logged in before this script starts.")
    print("Press Ctrl+C to stop.\n")

    app.run(
        host="127.0.0.1",  # localhost only — access via SSH tunnel
        port=FLASK_PORT,
        debug=False,
        threaded=True,     # handle concurrent requests (polling + MCP)
    )
