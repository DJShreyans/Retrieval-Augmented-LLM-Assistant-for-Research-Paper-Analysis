@echo off
title ResearchMate Launcher
echo ================================================================
echo                   ResearchMate Local Launcher
echo ================================================================
echo.

:: 1. Check Python installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    pause
    exit /b 1
)

:: 2. Check Node installation
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

:: 3. Check .env file
if not exist .env (
    echo [WARN] .env file not found. Creating from .env.example...
    copy .env.example .env
)

echo [1/3] Starting FastAPI Backend on http://localhost:8000...
start "ResearchMate Backend" cmd /k "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/3] Starting Next.js Frontend on http://localhost:3000...
cd frontend
start "ResearchMate Frontend" cmd /k "npm run dev"
cd ..

echo [3/3] Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

echo Opening browser...
start http://localhost:3000

echo.
echo ================================================================
echo ResearchMate is running!
echo - Frontend: http://localhost:3000
echo - Backend API: http://localhost:8000/docs
echo Close the individual terminal windows to stop the servers.
echo ================================================================
pause
