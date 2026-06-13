@echo off
title ResearchMate Backend Launcher
echo ===================================================
echo             ResearchMate FastAPI Backend           
echo ===================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your system PATH.
    echo Please install Python 3.10+ and select "Add Python to PATH" during setup.
    pause
    exit /b
)

cd backend

:: Check if virtual environment exists, if not create it
if not exist .venv (
    echo [INFO] Creating Python virtual environment (.venv)...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b
      )
)

echo [INFO] Activating virtual environment...
call .venv\Scripts\activate.bat

echo [INFO] Installing requirements (this may take a minute on first run)...
python -m pip install --upgrade pip
pip install -r requirements.txt

echo.
echo ===================================================
echo [SUCCESS] Backend is starting on http://localhost:8000
echo Check API documentation at http://localhost:8000/docs
echo ===================================================
echo.

uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

pause
