@echo off
REM ============================================================
REM start_live.bat — Start MT5 Flask bridge for LIVE account
REM
REM Prerequisites:
REM   1. Python 3.10+ installed: https://python.org
REM   2. pip install MetaTrader5 Flask flask-cors
REM   3. MT5 terminal running and logged into the live account
REM ============================================================

cd /d %~dp0

REM ── Configure these for your live account ──────────────────
set MT5_LOGIN=7967949
set MT5_PATH=C:\Program Files\MetaTrader 5 IC Markets Global\terminal64.exe
set MT5_SERVER=ICMarketsSC-MT5-2
set MT5_PASSWORD=
set FLASK_PORT=5555
REM ────────────────────────────────────────────────────────────

echo Starting MT5 bridge for live account %MT5_LOGIN% on port %FLASK_PORT%...
python mt5_api.py

pause
