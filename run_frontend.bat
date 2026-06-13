@echo off
title ResearchMate Frontend Launcher
echo ===================================================
echo             ResearchMate Next.js Frontend          
echo ===================================================
echo.

:: Check if Node is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Node.js or npm is not recognized as a command in this shell.
    echo Please install Node.js (v18+) from https://nodejs.org/ to run the Next.js frontend.
    echo.
    echo Press any key to open the Node.js download site, or close this window...
    pause >nul
    start "" "https://nodejs.org/"
    exit /b
)

cd frontend

:: Install packages if node_modules does not exist
if not exist node_modules (
    echo [INFO] First time setup: Downloading Next.js, Tailwind, React, and Lucide...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to run npm install.
        pause
        exit /b
    )
)

echo.
echo ===================================================
echo [SUCCESS] Frontend starting on http://localhost:3000
echo ===================================================
echo.

call npm run dev

pause
