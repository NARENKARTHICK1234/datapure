@echo off
title DataPure — Starting...
color 0A

echo.
echo  ============================================================
echo   DataPure — Intelligent Data Cleaning ^& Structural Validation
echo  ============================================================
echo.
echo  Starting backend server (FastAPI + React on port 8000)...
echo.

set "BACKEND=C:\Users\Dell\OneDrive\Desktop\INTERNSHIP PROJECT 1\backend"
set "PYTHON=%BACKEND%\.venv\Scripts\python.exe"

REM Kill any existing instance
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

REM Start backend (serves API + built React frontend)
start "DataPure API + UI" /D "%BACKEND%" "%PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

echo  Waiting for server to start...
timeout /t 6 /nobreak >nul

REM Open browser
echo  Opening browser at http://127.0.0.1:8000
start "" "http://127.0.0.1:8000"

echo.
echo  ============================================================
echo   DataPure is running at: http://127.0.0.1:8000
echo   API docs available at:  http://127.0.0.1:8000/docs
echo.
echo   Press Ctrl+C in the server window to stop.
echo  ============================================================
echo.
pause
