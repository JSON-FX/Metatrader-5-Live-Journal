@echo off
REM ============================================================
REM start_propfirm.bat — Start MT5 Flask bridge for PROP FIRM account
REM
REM Prerequisites:
REM   1. Python 3.10+ installed: https://python.org
REM   2. pip install MetaTrader5 Flask flask-cors
REM   3. MT5 terminal running and logged into the prop firm account
REM ============================================================

cd /d %~dp0

REM ── Configure these for your prop firm account ─────────────
set MT5_LOGIN=YOUR_PROPFIRM_ACCOUNT_NUMBER
set MT5_PATH=C:\Program Files\MetaTrader 5 (PropFirm)\terminal64.exe
set MT5_SERVER=YOUR_PROPFIRM_SERVER
set MT5_PASSWORD=
set FLASK_PORT=5556
REM ────────────────────────────────────────────────────────────

echo Starting MT5 bridge for prop firm account %MT5_LOGIN% on port %FLASK_PORT%...
python mt5_api.py

pause
